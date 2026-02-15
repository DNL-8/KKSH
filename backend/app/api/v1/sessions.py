from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response
from sqlalchemy import and_, or_
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.audit import log_event
from app.core.deps import (
    db_session,
    get_current_user,
    get_or_create_study_plan,
    get_or_create_user_settings,
    get_owned_session,
)
from app.models import StudySession, User
from app.schemas import CreateSessionIn, SessionListOut, SessionOut, UpdateSessionIn
from app.services.cursor import decode_cursor, encode_cursor
from app.services.progression import apply_xp_gold, compute_session_rewards
from app.services.quests import (
    apply_session_to_quests,
    ensure_daily_quests,
    recompute_daily_quests_for_day,
    recompute_weekly_quests_for_week,
)
from app.services.utils import date_key, now_local, parse_goals, week_key
from app.services.webhooks import enqueue_event

router = APIRouter()
VIDEO_COMPLETION_PREFIX = "video_completion::"


def _week_key_from_date_key(dk: str) -> str:
    try:
        from datetime import datetime

        return week_key(datetime.strptime(dk, "%Y-%m-%d"))
    except Exception:
        return week_key()


def _session_to_out(r: StudySession) -> SessionOut:
    return SessionOut(
        id=r.id,
        subject=r.subject,
        minutes=int(r.minutes),
        mode=r.mode,
        notes=r.notes,
        date=r.date_key,
        createdAt=r.created_at,
        xpEarned=int(r.xp_earned or 0),
        goldEarned=int(r.gold_earned or 0),
    )


def _normalize_video_completion_ref(*, mode: str | None, notes: str | None) -> str | None:
    if (mode or "").strip() != "video_lesson":
        return None
    raw_notes = (notes or "").strip()
    if not raw_notes.startswith(VIDEO_COMPLETION_PREFIX):
        return None
    ref = raw_notes[len(VIDEO_COMPLETION_PREFIX) :].strip()
    return ref or None


def _is_duplicate_video_completion_integrity_error(exc: IntegrityError) -> bool:
    message = str(exc).lower()
    return "xp_ledger_events" in message and (
        "uq_xp_ledger_source" in message or "source_ref" in message
    )


@router.post("", status_code=201)
def create_session(
    payload: CreateSessionIn,
    background: BackgroundTasks,
    request: Request,
    response: Response,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    # default to *today* in the user's timezone (frontend can pass explicit date when needed)
    # date_key is set by frontend via "date" for edits; for creates we keep current date.
    dk = date_key(now_local())

    normalized_notes = (
        payload.notes.strip() if isinstance(payload.notes, str) and payload.notes.strip() else None
    )
    video_completion_ref = _normalize_video_completion_ref(
        mode=payload.mode, notes=normalized_notes
    )
    if video_completion_ref:
        normalized_notes = f"{VIDEO_COMPLETION_PREFIX}{video_completion_ref}"
        existing = session.exec(
            select(StudySession.id).where(
                StudySession.user_id == user.id,
                StudySession.mode == "video_lesson",
                StudySession.notes == normalized_notes,
                StudySession.deleted_at.is_(None),
            )
        ).first()
        if existing:
            response.status_code = 200
            return {"ok": True, "xpEarned": 0, "goldEarned": 0}

    try:
        settings = get_or_create_user_settings(user, session, autocommit=False)
        xp, gold = compute_session_rewards(settings, minutes=int(payload.minutes))

        s = StudySession(
            user_id=user.id,
            subject=payload.subject,
            minutes=int(payload.minutes),
            mode=payload.mode,
            notes=normalized_notes,
            date_key=dk,
            xp_earned=xp,
            gold_earned=gold,
        )
        session.add(s)
        session.flush()

        source_type = "study_session"
        source_ref = s.id
        if video_completion_ref:
            source_type = "video_lesson_completion"
            source_ref = video_completion_ref

        log_event(
            session,
            request,
            "session.created",
            user=user,
            metadata={
                "id": s.id,
                "subject": s.subject,
                "minutes": int(s.minutes),
                "mode": s.mode,
                "date": s.date_key,
            },
            commit=False,
        )

        # update progression
        apply_xp_gold(
            session,
            user,
            xp_delta=xp,
            gold_delta=gold,
            autocommit=False,
            persist_ledger=True,
            event_type="session.created",
            source_type=source_type,
            source_ref=source_ref,
            payload_json={
                "sessionId": s.id,
                "subject": s.subject,
                "minutes": int(s.minutes),
                "mode": s.mode,
                "date": s.date_key,
            },
        )

        plan = get_or_create_study_plan(user, session, autocommit=False)
        goals = parse_goals(plan.goals_json)
        ensure_daily_quests(session=session, user=user, dk=dk, goals=goals, autocommit=False)
        apply_session_to_quests(session=session, study_session=s, autocommit=False)

        enqueue_event(
            background,
            session,
            user.id,
            "session.created",
            {
                "id": s.id,
                "subject": s.subject,
                "minutes": int(s.minutes),
                "mode": s.mode,
                "date": s.date_key,
                "xpEarned": int(xp),
                "goldEarned": int(gold),
            },
            commit=False,
        )

        session.commit()
    except IntegrityError as exc:
        session.rollback()
        if video_completion_ref and _is_duplicate_video_completion_integrity_error(exc):
            response.status_code = 200
            return {"ok": True, "xpEarned": 0, "goldEarned": 0}
        raise
    except Exception:
        session.rollback()
        raise

    return {"ok": True, "xpEarned": xp, "goldEarned": gold}


@router.get("", response_model=SessionListOut)
def list_sessions(
    limit: int = Query(default=50, ge=1, le=200),
    cursor: Optional[str] = Query(default=None, max_length=256),
    date_from: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    date_to: Optional[str] = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    subject: Optional[str] = Query(default=None, min_length=1, max_length=64),
    mode: Optional[str] = Query(default=None, min_length=1, max_length=32),
    response: Response = None,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    q = select(StudySession).where(
        StudySession.user_id == user.id, StudySession.deleted_at.is_(None)
    )
    if date_from:
        q = q.where(StudySession.date_key >= date_from)
    if date_to:
        q = q.where(StudySession.date_key <= date_to)
    if subject:
        q = q.where(StudySession.subject == subject)
    if mode:
        q = q.where(StudySession.mode == mode)

    if cursor:
        c_dt, c_id = decode_cursor(cursor)
        q = q.where(
            or_(
                StudySession.created_at < c_dt,
                and_(StudySession.created_at == c_dt, StudySession.id < c_id),
            )
        )

    rows = session.exec(
        q.order_by(StudySession.created_at.desc(), StudySession.id.desc()).limit(limit + 1)
    ).all()
    next_cursor = None
    if len(rows) > limit:
        last = rows[limit - 1]
        next_cursor = encode_cursor(last.created_at, last.id)
        rows = rows[:limit]
    if response is not None and next_cursor:
        response.headers["X-Next-Cursor"] = next_cursor
    return SessionListOut(sessions=[_session_to_out(r) for r in rows], nextCursor=next_cursor)


@router.get("/{session_id}", response_model=SessionOut)
def get_session(
    row: StudySession = Depends(get_owned_session),
):
    return _session_to_out(row)


@router.patch("/{session_id}", status_code=204)
def update_session(
    payload: UpdateSessionIn,
    background: BackgroundTasks,
    request: Request,
    row: StudySession = Depends(get_owned_session),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    old_dk = row.date_key
    old_xp = int(row.xp_earned or 0)
    old_gold = int(row.gold_earned or 0)

    try:
        if payload.subject is not None:
            row.subject = payload.subject
        if payload.minutes is not None:
            row.minutes = int(payload.minutes)
        if payload.mode is not None:
            row.mode = payload.mode
        if payload.notes is not None:
            row.notes = payload.notes
        if payload.date is not None:
            row.date_key = payload.date

        session.add(row)
        session.flush()

        # progression re-calc (only minutes affect rewards today)
        settings = get_or_create_user_settings(user, session, autocommit=False)
        new_xp, new_gold = compute_session_rewards(settings, minutes=int(row.minutes))
        row.xp_earned = new_xp
        row.gold_earned = new_gold
        session.add(row)

        apply_xp_gold(
            session,
            user,
            xp_delta=(new_xp - old_xp),
            gold_delta=(new_gold - old_gold),
            autocommit=False,
            persist_ledger=(new_xp != old_xp or new_gold != old_gold),
            event_type="session.updated",
            source_type="study_session_update",
            source_ref=f"{row.id}:{datetime.now(timezone.utc).isoformat()}",
            payload_json={
                "sessionId": row.id,
                "oldXp": old_xp,
                "newXp": new_xp,
                "oldGold": old_gold,
                "newGold": new_gold,
            },
        )

        # recompute quest progress for affected days
        plan = get_or_create_study_plan(user, session, autocommit=False)
        goals = parse_goals(plan.goals_json)
        recompute_daily_quests_for_day(
            session=session,
            user=user,
            dk=old_dk,
            goals=goals,
            autocommit=False,
        )
        recompute_weekly_quests_for_week(
            session=session,
            user=user,
            wk=_week_key_from_date_key(old_dk),
            goals=goals,
            autocommit=False,
        )
        if row.date_key != old_dk:
            recompute_daily_quests_for_day(
                session=session,
                user=user,
                dk=row.date_key,
                goals=goals,
                autocommit=False,
            )
        # Recompute weekly for the week containing the (possibly updated) session date.
        recompute_weekly_quests_for_week(
            session=session,
            user=user,
            wk=_week_key_from_date_key(row.date_key),
            goals=goals,
            autocommit=False,
        )
        enqueue_event(
            background,
            session,
            user.id,
            "session.updated",
            {
                "id": row.id,
                "subject": row.subject,
                "minutes": int(row.minutes),
                "mode": row.mode,
                "date": row.date_key,
                "xpEarned": int(row.xp_earned or 0),
                "goldEarned": int(row.gold_earned or 0),
            },
            commit=False,
        )

        log_event(
            session,
            request,
            "session.updated",
            user=user,
            metadata={
                "id": row.id,
                "subject": row.subject,
                "minutes": int(row.minutes),
                "mode": row.mode,
                "date": row.date_key,
            },
            commit=False,
        )

        session.commit()
    except Exception:
        session.rollback()
        raise

    return None


@router.delete("/{session_id}", status_code=204)
def delete_session(
    background: BackgroundTasks,
    request: Request,
    row: StudySession = Depends(get_owned_session),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    try:
        # progression rollback
        apply_xp_gold(
            session,
            user,
            xp_delta=-int(row.xp_earned or 0),
            gold_delta=-int(row.gold_earned or 0),
            autocommit=False,
            persist_ledger=True,
            event_type="session.deleted",
            source_type="study_session_delete",
            source_ref=f"{row.id}:delete",
            payload_json={"sessionId": row.id, "date": row.date_key},
        )

        row.deleted_at = datetime.now(timezone.utc)
        session.add(row)

        plan = get_or_create_study_plan(user, session, autocommit=False)
        goals = parse_goals(plan.goals_json)
        recompute_daily_quests_for_day(
            session=session,
            user=user,
            dk=row.date_key,
            goals=goals,
            autocommit=False,
        )
        recompute_weekly_quests_for_week(
            session=session,
            user=user,
            wk=_week_key_from_date_key(row.date_key),
            goals=goals,
            autocommit=False,
        )

        enqueue_event(
            background,
            session,
            user.id,
            "session.deleted",
            {
                "id": row.id,
                "subject": row.subject,
                "minutes": int(row.minutes),
                "mode": row.mode,
                "date": row.date_key,
            },
            commit=False,
        )

        log_event(
            session,
            request,
            "session.deleted",
            user=user,
            metadata={
                "id": row.id,
                "subject": row.subject,
                "minutes": int(row.minutes),
                "mode": row.mode,
                "date": row.date_key,
            },
            commit=False,
        )

        session.commit()
    except Exception:
        session.rollback()
        raise

    return None
