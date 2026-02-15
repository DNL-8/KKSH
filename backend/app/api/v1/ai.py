from __future__ import annotations

import json
import re
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, Field
from sqlmodel import Session, select
from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.deps import db_session, get_current_user, get_optional_user
from app.core.metrics import record_ai_error, record_ai_rate_limited, record_ai_request
from app.core.rate_limit import Rule, client_ip, get_redis_client, rate_limit
from app.models import SystemWindowMessage, User

router = APIRouter(prefix="/ai", tags=["ai"])
chat_router = APIRouter(tags=["ai"])
chat_alias_router = APIRouter(tags=["ai"])

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

_API_KEY_PLACEHOLDERS = {"", "SUA_CHAVE_AQUI", "YOUR_API_KEY_HERE"}
_AI_BURST_RULE = Rule(
    max_requests=max(1, int(settings.ai_rate_limit_max)),
    window_seconds=max(1, int(settings.ai_rate_limit_window_sec)),
)
_guest_daily_hits: dict[str, deque[float]] = defaultdict(deque)
_user_daily_hits: dict[str, deque[float]] = defaultdict(deque)
_user_burst_hits: dict[str, deque[float]] = defaultdict(deque)
_RETRY_AFTER_PATTERN = re.compile(
    r"(?:retry(?:-|\s)?after|retry(?:_|\s)?in)\D*(\d+)", re.IGNORECASE
)
_SECONDS_PATTERN = re.compile(r"seconds?\D*(\d+)", re.IGNORECASE)


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


def _extract_first_text(payload: dict[str, Any]) -> str | None:
    candidates = payload.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        return None
    first = candidates[0]
    if not isinstance(first, dict):
        return None
    content = first.get("content")
    if not isinstance(content, dict):
        return None
    parts = content.get("parts")
    if not isinstance(parts, list) or not parts:
        return None
    part = parts[0]
    if not isinstance(part, dict):
        return None
    text = part.get("text")
    if not isinstance(text, str):
        return None
    cleaned = text.strip()
    return cleaned or None


def _parse_json_object(raw: str) -> dict[str, Any] | None:
    cleaned = raw.replace("```json", "").replace("```", "").strip()
    if not cleaned:
        return None
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


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


def _get_api_key() -> str:
    raw = settings.gemini_api_key.strip()
    if raw.upper() in _API_KEY_PLACEHOLDERS:
        return ""
    return raw


def _extract_sdk_text(response: Any) -> str | None:
    text: Any = None
    try:
        text = getattr(response, "text", None)
    except Exception:
        text = None

    if isinstance(text, str):
        cleaned = text.strip()
        if cleaned:
            return cleaned

    to_dict = getattr(response, "to_dict", None)
    if callable(to_dict):
        try:
            payload = to_dict()
        except Exception:
            payload = None
        if isinstance(payload, dict):
            return _extract_first_text(payload)
    return None


def _resolve_model_chain() -> list[str]:
    raw = settings.gemini_model_chain.strip()
    if not raw:
        return [settings.gemini_model]
    parsed = [part.strip() for part in raw.split(",") if part.strip()]
    if not parsed:
        return [settings.gemini_model]
    unique: list[str] = []
    seen: set[str] = set()
    for model in parsed:
        if model in seen:
            continue
        seen.add(model)
        unique.append(model)
    return unique or [settings.gemini_model]


def _coerce_positive_int(value: Any) -> int | None:
    try:
        parsed = int(str(value).strip())
    except Exception:
        return None
    if parsed <= 0:
        return None
    return parsed


def _extract_provider_status(exc: Exception, text: str) -> int | None:
    for attr in ("status_code", "http_status", "status", "code"):
        raw = getattr(exc, attr, None)
        parsed = _coerce_positive_int(raw)
        if parsed is not None and 100 <= parsed <= 599:
            return parsed

    response = getattr(exc, "response", None)
    if response is not None:
        for attr in ("status_code", "status"):
            raw = getattr(response, attr, None)
            parsed = _coerce_positive_int(raw)
            if parsed is not None and 100 <= parsed <= 599:
                return parsed

    match = re.search(r"\b([45]\d{2})\b", text)
    if match:
        parsed = _coerce_positive_int(match.group(1))
        if parsed is not None and 100 <= parsed <= 599:
            return parsed
    return None


def _extract_retry_after_sec(exc: Exception, text: str) -> int | None:
    for attr in ("retry_after", "retry_after_sec", "retry_after_seconds"):
        parsed = _coerce_positive_int(getattr(exc, attr, None))
        if parsed is not None:
            return parsed

    response = getattr(exc, "response", None)
    if response is not None:
        headers = getattr(response, "headers", None)
        if isinstance(headers, dict):
            parsed = _coerce_positive_int(headers.get("retry-after") or headers.get("Retry-After"))
            if parsed is not None:
                return parsed
        else:
            raw = None
            get_header = getattr(headers, "get", None)
            if callable(get_header):
                raw = get_header("Retry-After") or get_header("retry-after")
            parsed = _coerce_positive_int(raw)
            if parsed is not None:
                return parsed

    retry_match = _RETRY_AFTER_PATTERN.search(text)
    if retry_match:
        parsed = _coerce_positive_int(retry_match.group(1))
        if parsed is not None:
            return parsed

    seconds_match = _SECONDS_PATTERN.search(text)
    if seconds_match:
        parsed = _coerce_positive_int(seconds_match.group(1))
        if parsed is not None:
            return parsed

    return None


def _is_quota_error(message: str, provider_status: int | None) -> bool:
    lowered = message.lower()
    quota_tokens = (
        "quota",
        "resource_exhausted",
        "exhausted",
        "rate limit",
        "too many requests",
        "exceeded",
    )
    quota_like = any(token in lowered for token in quota_tokens)
    if provider_status == 429 and quota_like:
        return True
    if provider_status in (403, 429) and ("quota" in lowered or "resource_exhausted" in lowered):
        return True
    if quota_like and "429" in lowered:
        return True
    return False


def _classify_provider_error(
    exc: Exception,
    *,
    stage: Literal["initialization", "request"],
    model_name: str,
) -> dict[str, Any]:
    raw_message = str(exc).strip() or exc.__class__.__name__
    provider_status = _extract_provider_status(exc, raw_message)
    retry_after_sec = _extract_retry_after_sec(exc, raw_message)
    message_lower = raw_message.lower()

    details: dict[str, Any] = {
        "error": raw_message,
        "model": model_name,
        "stage": stage,
    }
    if provider_status is not None:
        details["providerStatus"] = provider_status
    if retry_after_sec is not None:
        details["retryAfterSec"] = retry_after_sec

    if _is_quota_error(raw_message, provider_status):
        return {
            "status_code": status.HTTP_429_TOO_MANY_REQUESTS,
            "code": "ai_quota_exceeded",
            "message": "AI provider quota exceeded",
            "details": details,
        }

    timeout_like = (
        isinstance(exc, TimeoutError)
        or "timeout" in message_lower
        or "timed out" in message_lower
        or "deadline exceeded" in message_lower
    )
    if timeout_like and retry_after_sec is None:
        details["retryAfterSec"] = 1

    return {
        "status_code": status.HTTP_502_BAD_GATEWAY,
        "code": "ai_upstream_error",
        "message": "AI provider request failed",
        "details": details,
    }


def _raise_provider_error(error_info: dict[str, Any]) -> None:
    details = error_info.get("details")
    if not isinstance(details, dict):
        details = {}
    retry_after = _coerce_positive_int(details.get("retryAfterSec"))
    headers: dict[str, str] | None = None
    if retry_after is not None:
        headers = {"Retry-After": str(retry_after)}

    _error(
        int(error_info.get("status_code", status.HTTP_502_BAD_GATEWAY)),
        code=str(error_info.get("code", "ai_upstream_error")),
        message=str(error_info.get("message", "AI provider request failed")),
        details=details,
        headers=headers,
    )


def _create_model(
    *,
    model_name: str,
    system_instruction: str | None = None,
    response_mime_type: str | None = None,
) -> Any:
    api_key = _get_api_key()
    if not api_key:
        _error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            code="ai_unavailable",
            message="AI provider not configured",
        )

    try:
        from google import genai
    except Exception as exc:
        _error(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            code="ai_sdk_unavailable",
            message="AI SDK is not installed",
        )
        raise exc

    client = genai.Client(api_key=api_key)

    config: dict[str, Any] = {}
    if system_instruction:
        config["system_instruction"] = system_instruction
    if response_mime_type:
        config["response_mime_type"] = response_mime_type

    return (client, model_name, config)


async def _generate_content_text(
    *,
    prompt: str,
    system_instruction: str | None = None,
    response_mime_type: str | None = None,
) -> str | None:
    models = _resolve_model_chain()
    last_provider_error: dict[str, Any] | None = None
    got_empty_payload = False
    t0 = time.perf_counter()

    for model_name in models:
        try:
            client, resolved_model, config = _create_model(
                model_name=model_name,
                system_instruction=system_instruction,
                response_mime_type=response_mime_type,
            )
        except HTTPException:
            raise
        except Exception as exc:
            last_provider_error = _classify_provider_error(
                exc,
                stage="initialization",
                model_name=model_name,
            )
            record_ai_error("generate", error_type="init_error")
            continue

        try:
            response = await run_in_threadpool(
                client.models.generate_content,
                model=resolved_model,
                contents=prompt,
                config=config if config else None,
            )
        except HTTPException:
            raise
        except Exception as exc:
            last_provider_error = _classify_provider_error(
                exc,
                stage="request",
                model_name=model_name,
            )
            error_type = (
                last_provider_error.get("code", "unknown") if last_provider_error else "unknown"
            )
            record_ai_error("generate", error_type=error_type)
            continue

        text = _extract_sdk_text(response)
        if text:
            record_ai_request("generate", time.perf_counter() - t0)
            return text
        got_empty_payload = True

    if last_provider_error is not None:
        _raise_provider_error(last_provider_error)

    if got_empty_payload:
        record_ai_error("generate", error_type="empty_payload")
        _error(
            status.HTTP_502_BAD_GATEWAY,
            code="ai_invalid_response",
            message="AI provider returned empty payload",
        )

    record_ai_error("generate", error_type="all_failed")
    _error(
        status.HTTP_502_BAD_GATEWAY,
        code="ai_upstream_error",
        message="AI provider request failed",
        details={"error": "No AI model attempts were successful."},
    )


async def _enforce_guest_daily_limit(request: Request) -> None:
    await _enforce_fixed_window_limit(
        scope="ai_guest_daily",
        actor_key=f"guest:{client_ip(request)}",
        max_requests=max(1, int(settings.ai_guest_daily_max)),
        window_seconds=max(1, int(settings.ai_guest_daily_window_sec)),
        in_memory_buckets=_guest_daily_hits,
        message="Guest daily AI limit reached",
    )


async def _enforce_fixed_window_limit(
    *,
    scope: str,
    actor_key: str,
    max_requests: int,
    window_seconds: int,
    in_memory_buckets: dict[str, deque[float]],
    message: str,
) -> None:
    max_requests = max(1, int(max_requests))
    window_seconds = max(1, int(window_seconds))
    now = time.time()

    redis_client = get_redis_client()
    if redis_client is not None:
        bucket = int(now // window_seconds)
        key = f"rl:{scope}:{actor_key}:{bucket}"
        try:
            count = int(await redis_client.incr(key))
            await redis_client.expire(key, int(window_seconds) + 5)
            if count > max_requests:
                record_ai_rate_limited(scope)
                _error(
                    status.HTTP_429_TOO_MANY_REQUESTS,
                    code="rate_limited",
                    message=message,
                    details={
                        "scope": scope,
                        "limit": max_requests,
                        "windowSec": window_seconds,
                    },
                )
            return
        except Exception:
            # Redis hiccups should not take down the endpoint.
            pass

    bucket = in_memory_buckets[actor_key]
    cutoff = now - window_seconds
    while bucket and bucket[0] < cutoff:
        bucket.popleft()

    if len(bucket) >= max_requests:
        record_ai_rate_limited(scope)
        _error(
            status.HTTP_429_TOO_MANY_REQUESTS,
            code="rate_limited",
            message=message,
            details={
                "scope": scope,
                "limit": max_requests,
                "windowSec": window_seconds,
            },
        )

    bucket.append(now)


async def _enforce_user_daily_limit(user: User) -> None:
    await _enforce_fixed_window_limit(
        scope="ai_user_daily",
        actor_key=f"user:{user.id}",
        max_requests=max(1, int(settings.ai_user_daily_max)),
        window_seconds=max(1, int(settings.ai_user_daily_window_sec)),
        in_memory_buckets=_user_daily_hits,
        message="User daily AI limit reached",
    )


async def _enforce_user_burst_limit(user: User) -> None:
    await _enforce_fixed_window_limit(
        scope="ai_user_burst",
        actor_key=f"user:{user.id}",
        max_requests=max(1, int(settings.ai_rate_limit_max)),
        window_seconds=max(1, int(settings.ai_rate_limit_window_sec)),
        in_memory_buckets=_user_burst_hits,
        message="User AI burst limit reached",
    )


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


@router.post(
    "/text",
    response_model=AiTextOut,
    dependencies=[Depends(rate_limit("ai_text", _AI_BURST_RULE))],
)
async def generate_text(
    payload: AiTextIn,
    user: User = Depends(get_current_user),
):
    await _enforce_user_burst_limit(user)
    await _enforce_user_daily_limit(user)

    system_instruction = payload.systemInstruction.strip() or None
    text = await _generate_content_text(
        prompt=payload.prompt,
        system_instruction=system_instruction,
    )
    return AiTextOut(text=text)


async def _monitor_hunter_message(mensagem: str) -> HunterSystemOut:
    raw = await _generate_content_text(
        prompt=mensagem,
        system_instruction=HUNTER_SYSTEM_PROMPT,
        response_mime_type="application/json",
    )
    if not raw:
        _error(
            status.HTTP_502_BAD_GATEWAY,
            code="ai_invalid_response",
            message="AI provider returned empty payload",
        )

    parsed = _parse_json_object(raw)
    if parsed is None:
        _error(
            status.HTTP_502_BAD_GATEWAY,
            code="ai_invalid_response",
            message="AI provider returned non-JSON payload",
        )

    return _normalize_hunter_payload(parsed)


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
        await _enforce_guest_daily_limit(request)
    else:
        await _enforce_user_burst_limit(user)
        await _enforce_user_daily_limit(user)
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
        await _enforce_guest_daily_limit(request)
    else:
        await _enforce_user_burst_limit(user)
        await _enforce_user_daily_limit(user)
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
        "Warning": '299 - "Deprecated endpoint. Use /api/v1/chat"',
    }
    for key, value in deprecation_headers.items():
        response.headers[key] = value

    if user is None:
        await _enforce_guest_daily_limit(request)
    else:
        await _enforce_user_burst_limit(user)
        await _enforce_user_daily_limit(user)
    try:
        return await _monitor_hunter_message(payload.mensagem)
    except HTTPException as exc:
        extra_headers = dict(exc.headers or {})
        extra_headers.update(deprecation_headers)
        exc.headers = extra_headers
        raise
