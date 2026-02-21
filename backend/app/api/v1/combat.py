from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlmodel import Session

from app.core.audit import command_audit_metadata, log_event
from app.core.deps import db_session, get_current_user
from app.core.rate_limit import Rule, rate_limit
from app.models import User
from app.schemas import (
    CombatAnswerIn,
    CombatAnswerOut,
    CombatConsumeIn,
    CombatConsumeOut,
    CombatFleeIn,
    CombatFleeOut,
    CombatQuestionIn,
    CombatQuestionOutEnvelope,
    CombatStartIn,
    CombatStartOut,
)
from app.services.backend_first import CommandError, require_idempotency_key
from app.services.combat import answer_question, consume_item_in_battle, draw_question, flee_battle, start_battle

router = APIRouter(prefix="/combat", tags=["combat"])
_COMBAT_RULE = Rule(max_requests=40, window_seconds=60)


@router.post(
    "/start",
    response_model=CombatStartOut,
    dependencies=[Depends(rate_limit("combat_start", _COMBAT_RULE))],
)
def start_combat(
    payload: CombatStartIn,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    try:
        key = require_idempotency_key(idempotency_key)
        result = start_battle(
            session,
            user=user,
            module_id=payload.moduleId,
            reset=bool(payload.reset),
            idempotency_key=key,
        )
        log_event(
            session,
            request,
            "combat.start",
            user=user,
            metadata=command_audit_metadata(
                command_type="combat.start",
                idempotency_key=key,
                extra={"moduleId": result["moduleId"], "reset": bool(payload.reset)},
            ),
            commit=False,
        )
        session.commit()
        return result
    except CommandError as exc:
        session.rollback()
        raise HTTPException(status_code=exc.status_code, detail=exc.to_http_detail()) from exc
    except Exception:
        session.rollback()
        raise


@router.post(
    "/question",
    response_model=CombatQuestionOutEnvelope,
    dependencies=[Depends(rate_limit("combat_question", _COMBAT_RULE))],
)
def start_question_turn(
    payload: CombatQuestionIn,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    try:
        key = require_idempotency_key(idempotency_key)
        result = draw_question(
            session,
            user=user,
            battle_id=payload.battleId,
            idempotency_key=key,
        )
        log_event(
            session,
            request,
            "combat.question",
            user=user,
            metadata=command_audit_metadata(
                command_type="combat.question",
                idempotency_key=key,
                extra={"battleId": payload.battleId, "questionId": result["question"]["id"]},
            ),
            commit=False,
        )
        session.commit()
        return result
    except CommandError as exc:
        session.rollback()
        raise HTTPException(status_code=exc.status_code, detail=exc.to_http_detail()) from exc
    except Exception:
        session.rollback()
        raise


@router.post(
    "/answer",
    response_model=CombatAnswerOut,
    dependencies=[Depends(rate_limit("combat_answer", _COMBAT_RULE))],
)
def answer_combat_question(
    payload: CombatAnswerIn,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    try:
        key = require_idempotency_key(idempotency_key)
        result = answer_question(
            session,
            user=user,
            battle_id=payload.battleId,
            question_id=payload.questionId,
            option_index=int(payload.optionIndex),
            idempotency_key=key,
        )
        log_event(
            session,
            request,
            "combat.answer",
            user=user,
            metadata=command_audit_metadata(
                command_type="combat.answer",
                idempotency_key=key,
                extra={
                    "battleId": payload.battleId,
                    "questionId": payload.questionId,
                    "result": result["result"],
                },
            ),
            commit=False,
        )
        session.commit()
        return result
    except CommandError as exc:
        session.rollback()
        raise HTTPException(status_code=exc.status_code, detail=exc.to_http_detail()) from exc
    except Exception:
        session.rollback()
        raise


@router.post(
    "/flee",
    response_model=CombatFleeOut,
    dependencies=[Depends(rate_limit("combat_flee", _COMBAT_RULE))],
)
def flee_from_combat(
    payload: CombatFleeIn,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    try:
        key = require_idempotency_key(idempotency_key)
        result = flee_battle(
            session,
            user=user,
            battle_id=payload.battleId,
            idempotency_key=key,
        )
        log_event(
            session,
            request,
            "combat.flee",
            user=user,
            metadata=command_audit_metadata(
                command_type="combat.flee",
                idempotency_key=key,
                extra={
                    "battleId": payload.battleId,
                    "extracted": True,
                },
            ),
            commit=False,
        )
        session.commit()
        return result
    except CommandError as exc:
        session.rollback()
        raise HTTPException(status_code=exc.status_code, detail=exc.to_http_detail()) from exc
    except Exception:
        session.rollback()
        raise


@router.post(
    "/consume",
    response_model=CombatConsumeOut,
    dependencies=[Depends(rate_limit("combat_consume", _COMBAT_RULE))],
)
def consume_item_in_combat(
    payload: CombatConsumeIn,
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    try:
        key = require_idempotency_key(idempotency_key)
        result = consume_item_in_battle(
            session,
            user=user,
            battle_id=payload.battleId,
            item_id=payload.itemId,
            idempotency_key=key,
        )
        log_event(
            session,
            request,
            "combat.consume",
            user=user,
            metadata=command_audit_metadata(
                command_type="combat.consume",
                idempotency_key=key,
                extra={
                    "battleId": payload.battleId,
                    "itemId": payload.itemId,
                    "healAmount": result["healAmount"],
                },
            ),
            commit=False,
        )
        session.commit()
        return result
    except CommandError as exc:
        session.rollback()
        raise HTTPException(status_code=exc.status_code, detail=exc.to_http_detail()) from exc
    except Exception:
        session.rollback()
        raise
