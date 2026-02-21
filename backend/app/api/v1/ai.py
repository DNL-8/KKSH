"""AI endpoints: Hunter chat, text generation, system window history."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from app.core.config import settings
from app.core.deps import db_session, get_current_user, get_optional_user
from app.core.rate_limit import Rule, rate_limit
from app.models import SystemWindowMessage, User

from app.services.gemini_client import (
    GeminiError,
    generate_content_text,
    parse_json_object,
)
from app.services.ai_rate_limiter import (
    enforce_guest_daily_limit,
    enforce_user_burst_limit,
    enforce_user_daily_limit,
)

router = APIRouter(prefix="/ai", tags=["ai"])
chat_router = APIRouter(tags=["ai"])
chat_alias_router = APIRouter(tags=["ai"])

_AI_BURST_RULE = Rule(
    max_requests=max(1, int(settings.ai_rate_limit_max)),
    window_seconds=max(1, int(settings.ai_rate_limit_window_sec)),
)

HUNTER_SYSTEM_PROMPT = """
SISTEMA DE MONITORAMENTO DE HUNTERS (SOLO LEVELING)

CONTEXTO:
Voce e o "Sistema". Sua interface e uma janela flutuante azul neon. Seu tom e frio,
direto e focado no crescimento do Hunter (o usuario). Voce nao e um assistente amigavel;
voce e uma entidade que gerencia a evolucao de um despertado.

DIRETRIZES DE PERSONALIDADE:
1. Trate o usuario exclusivamente como "Hunter".
2. Use termos como [STATUS], [MISSAO], [RECOMPENSA], [PENALIDADE] e [LEVEL UP].
3. Se o Hunter for preguicoso, seja severo. Se ele estudar muito, reconheca o progresso.
4. Mantenha as respostas curtas e impactantes, como em uma interface de jogo.

REGRAS DE GAMIFICACAO E DADOS:
Voce deve analisar a mensagem do Hunter e extrair as seguintes informacoes:
- 'xp_ganho': atribua entre 5 a 20 XP para relatos de estudo
  (Python, SQL, Engenharia de Dados).
- 'missao_concluida': true se ele relatar a finalizacao de uma tarefa,
  caso contrario, false.
- 'status_mensagem': uma frase curta de efeito.

FORMATO DE SAIDA OBRIGATORIO (JSON):
{
  "resposta_texto": "O texto que o usuario lera no chat",
  "xp_ganho": numero inteiro,
  "missao_concluida": boolean,
  "status_mensagem": "Frase curta"
}
""".strip()


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class AiTextIn(BaseModel):
    prompt: str = Field(min_length=1, max_length=8000)
    systemInstruction: str = Field(default="", max_length=4000)


class AiTextOut(BaseModel):
    text: str | None = None


class HunterMessageIn(BaseModel):
    mensagem: str = Field(min_length=1, max_length=8000)


class HunterSystemOut(BaseModel):
    resposta_texto: str
    xp_ganho: int
    missao_concluida: bool
    status_mensagem: str


class SystemWindowMessageIn(BaseModel):
    role: Literal["user", "system"] = "system"
    content: str = Field(min_length=1, max_length=8000)
    source: str = Field(default="gemini", min_length=1, max_length=32)
    xpHint: int | None = Field(default=None, ge=0, le=1000)
    missionDoneHint: bool | None = None
    statusHint: str | None = Field(default=None, max_length=200)


class SystemWindowHistoryAppendIn(BaseModel):
    messages: list[SystemWindowMessageIn] = Field(default_factory=list, max_length=100)


class SystemWindowMessageOut(BaseModel):
    id: str
    role: Literal["user", "system"]
    content: str
    source: str
    xpHint: int | None = None
    missionDoneHint: bool | None = None
    statusHint: str | None = None
    createdAt: datetime


class SystemWindowHistoryOut(BaseModel):
    messages: list[SystemWindowMessageOut]


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _error(
    status_code: int,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
):
    raise HTTPException(
        status_code=status_code,
        detail={
            "code": code,
            "message": message,
            "details": details or {},
        },
        headers=headers,
    )


def _gemini_error_to_http(exc: GeminiError) -> None:
    """Convert a GeminiError into an HTTPException."""
    retry_after = exc.details.get("retryAfterSec")
    headers: dict[str, str] | None = None
    if retry_after is not None:
        headers = {"Retry-After": str(retry_after)}
    _error(exc.status_code, exc.code, str(exc), exc.details, headers)


def _to_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "sim", "y"}
    if isinstance(value, (int, float)):
        return value != 0
    return False


def _normalize_hunter_payload(payload: dict[str, Any]) -> HunterSystemOut:
    try:
        xp = int(payload.get("xp_ganho", 0))
    except (TypeError, ValueError):
        xp = 0

    xp = max(0, min(20, xp))
    resposta = str(payload.get("resposta_texto", "")).strip()
    status_msg = str(payload.get("status_mensagem", "")).strip()

    if not resposta:
        resposta = "[STATUS] Sem resposta valida do Sistema."
    if not status_msg:
        status_msg = "Sincronizacao parcial."

    return HunterSystemOut(
        resposta_texto=resposta,
        xp_ganho=xp,
        missao_concluida=_to_bool(payload.get("missao_concluida", False)),
        status_mensagem=status_msg,
    )


# ---------------------------------------------------------------------------
# System window history helpers
# ---------------------------------------------------------------------------


def _to_history_out(row: SystemWindowMessage) -> SystemWindowMessageOut:
    role: Literal["user", "system"] = "user" if row.role == "user" else "system"
    return SystemWindowMessageOut(
        id=row.id,
        role=role,
        content=row.content,
        source=row.source,
        xpHint=row.xp_hint,
        missionDoneHint=row.mission_done_hint,
        statusHint=row.status_hint,
        createdAt=row.created_at,
    )


def _read_history(session: Session, user_id: str, limit: int) -> list[SystemWindowMessage]:
    capped = max(1, min(int(limit), max(1, int(settings.ai_history_max_messages))))
    rows = session.exec(
        select(SystemWindowMessage)
        .where(SystemWindowMessage.user_id == user_id)
        .order_by(SystemWindowMessage.created_at.desc())
        .limit(capped)
    ).all()
    rows.reverse()
    return rows


def _prune_history(session: Session, user_id: str) -> None:
    keep = max(1, int(settings.ai_history_max_messages))
    overflow_ids = session.exec(
        select(SystemWindowMessage.id)
        .where(SystemWindowMessage.user_id == user_id)
        .order_by(SystemWindowMessage.created_at.desc())
        .offset(keep)
    ).all()
    if not overflow_ids:
        return

    for message_id in overflow_ids:
        row = session.get(SystemWindowMessage, message_id)
        if row is not None:
            session.delete(row)
    session.commit()


# ---------------------------------------------------------------------------
# Hunter chat logic
# ---------------------------------------------------------------------------


async def _monitor_hunter_message(mensagem: str) -> HunterSystemOut:
    try:
        raw = await generate_content_text(
            prompt=mensagem,
            system_instruction=HUNTER_SYSTEM_PROMPT,
            response_mime_type="application/json",
        )
    except GeminiError as exc:
        _gemini_error_to_http(exc)

    if not raw:
        _error(
            status.HTTP_502_BAD_GATEWAY,
            code="ai_invalid_response",
            message="AI provider returned empty payload",
        )

    parsed = parse_json_object(raw)
    if parsed is None:
        _error(
            status.HTTP_502_BAD_GATEWAY,
            code="ai_invalid_response",
            message="AI provider returned non-JSON payload",
        )

    return _normalize_hunter_payload(parsed)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/text",
    response_model=AiTextOut,
    dependencies=[Depends(rate_limit("ai_text", _AI_BURST_RULE))],
)
async def generate_text(
    payload: AiTextIn,
    user: User = Depends(get_current_user),
):
    await enforce_user_burst_limit(user)
    await enforce_user_daily_limit(user)

    system_instruction = payload.systemInstruction.strip() or None
    try:
        text = await generate_content_text(
            prompt=payload.prompt,
            system_instruction=system_instruction,
        )
    except GeminiError as exc:
        _gemini_error_to_http(exc)
    return AiTextOut(text=text)


@router.get("/system-history", response_model=SystemWindowHistoryOut)
def get_system_history(
    limit: int = Query(default=80, ge=1, le=500),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    rows = _read_history(session, user.id, limit)
    return SystemWindowHistoryOut(messages=[_to_history_out(row) for row in rows])


@router.post("/system-history", response_model=SystemWindowHistoryOut)
def append_system_history(
    payload: SystemWindowHistoryAppendIn,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    if payload.messages:
        base = datetime.now(timezone.utc)
        for idx, message in enumerate(payload.messages):
            content = message.content.strip()
            if not content:
                continue
            row = SystemWindowMessage(
                user_id=user.id,
                role=message.role,
                content=content,
                source=message.source.strip() or "gemini",
                xp_hint=message.xpHint,
                mission_done_hint=message.missionDoneHint,
                status_hint=(message.statusHint.strip() if message.statusHint else None),
                created_at=base + timedelta(milliseconds=idx),
            )
            session.add(row)
        session.commit()
        _prune_history(session, user.id)

    rows = _read_history(session, user.id, limit=max(1, int(settings.ai_history_max_messages)))
    return SystemWindowHistoryOut(messages=[_to_history_out(row) for row in rows])


@router.delete("/system-history", status_code=204)
def clear_system_history(
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    rows = session.exec(
        select(SystemWindowMessage).where(SystemWindowMessage.user_id == user.id)
    ).all()
    if rows:
        for row in rows:
            session.delete(row)
        session.commit()
    return Response(status_code=204)


@router.post(
    "/hunter",
    response_model=HunterSystemOut,
    dependencies=[Depends(rate_limit("ai_hunter", _AI_BURST_RULE))],
)
async def monitor_hunter(
    payload: HunterMessageIn,
    request: Request,
    user: User | None = Depends(get_optional_user),
):
    if user is None:
        await enforce_guest_daily_limit(request)
    else:
        await enforce_user_burst_limit(user)
        await enforce_user_daily_limit(user)
    return await _monitor_hunter_message(payload.mensagem)


@chat_router.post(
    "/chat",
    response_model=HunterSystemOut,
    dependencies=[Depends(rate_limit("ai_chat", _AI_BURST_RULE))],
)
async def chat_sistema_api(
    payload: HunterMessageIn,
    request: Request,
    user: User | None = Depends(get_optional_user),
):
    if user is None:
        await enforce_guest_daily_limit(request)
    else:
        await enforce_user_burst_limit(user)
        await enforce_user_daily_limit(user)
    return await _monitor_hunter_message(payload.mensagem)


@chat_alias_router.post(
    "/chat",
    response_model=HunterSystemOut,
    dependencies=[Depends(rate_limit("chat_alias", _AI_BURST_RULE))],
)
async def chat_sistema(
    payload: HunterMessageIn,
    request: Request,
    response: Response,
    user: User | None = Depends(get_optional_user),
):
    # Legacy compatibility route. Keep temporarily and steer callers to /api/v1/chat.
    deprecation_headers = {
        "Deprecation": "true",
        "Sunset": "Sat, 14 Mar 2026 00:00:00 GMT",
        "Link": '</api/v1/chat>; rel="successor-version"',
    }

    try:
        if user is None:
            await enforce_guest_daily_limit(request)
        else:
            await enforce_user_burst_limit(user)
            await enforce_user_daily_limit(user)

        result = await _monitor_hunter_message(payload.mensagem)
    except HTTPException as exc:
        # Attach deprecation headers even on error responses.
        existing = dict(exc.headers) if exc.headers else {}
        existing.update(deprecation_headers)
        exc.headers = existing
        raise

    for key, value in deprecation_headers.items():
        response.headers[key] = value
    return result
