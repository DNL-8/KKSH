from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models import (
    CommandIdempotency,
    DailyQuest,
    RewardClaim,
    StudySession,
    User,
    WeeklyQuest,
    XpLedgerEvent,
)
from app.services.progression import apply_xp_gold, get_or_create_user_stats, progress_to_dict
from app.services.utils import now_local, week_key

MissionCycle = Literal["daily", "weekly"]


@dataclass
class CommandError(Exception):
    status_code: int
    code: str
    message: str
    details: dict[str, Any] | None = None

    def to_http_detail(self) -> dict[str, Any]:
        return {
            "code": self.code,
            "message": self.message,
            "details": self.details or {},
        }


def require_idempotency_key(value: str | None) -> str:
    key = (value or "").strip()
    if not key:
        raise CommandError(
            status_code=422,
            code="idempotency_key_required",
            message="Idempotency-Key header is required",
        )
    if len(key) > 128:
        raise CommandError(
            status_code=422,
            code="idempotency_key_invalid",
            message="Idempotency-Key must be <= 128 chars",
        )
    return key


def _load_idempotency(
    session: Session,
    *,
    user_id: str,
    command_type: str,
    idempotency_key: str,
) -> CommandIdempotency | None:
    return session.exec(
        select(CommandIdempotency).where(
            CommandIdempotency.user_id == user_id,
            CommandIdempotency.command_type == command_type,
            CommandIdempotency.idempotency_key == idempotency_key,
        )
    ).first()


def save_idempotency_result(
    session: Session,
    *,
    user_id: str,
    command_type: str,
    idempotency_key: str,
    response_json: dict[str, Any],
    status_code: int = 200,
) -> dict[str, Any]:
    row = CommandIdempotency(
        user_id=user_id,
        command_type=command_type,
        idempotency_key=idempotency_key,
        response_json=response_json,
        status_code=status_code,
    )
    session.add(row)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        replay = _load_idempotency(
            session,
            user_id=user_id,
            command_type=command_type,
            idempotency_key=idempotency_key,
        )
        if replay:
            return replay.response_json
        raise
    return response_json


def idempotency_replay(
    session: Session,
    *,
    user_id: str,
    command_type: str,
    idempotency_key: str,
) -> dict[str, Any] | None:
    row = _load_idempotency(
        session,
        user_id=user_id,
        command_type=command_type,
        idempotency_key=idempotency_key,
    )
    if not row:
        return None
    return dict(row.response_json)


def _resolve_mission(
    session: Session,
    *,
    user_id: str,
    mission_instance_id: str,
) -> tuple[MissionCycle, DailyQuest | WeeklyQuest]:
    daily = session.exec(
        select(DailyQuest).where(DailyQuest.id == mission_instance_id, DailyQuest.user_id == user_id)
    ).first()
    if daily:
        return "daily", daily
    weekly = session.exec(
        select(WeeklyQuest).where(
            WeeklyQuest.id == mission_instance_id,
            WeeklyQuest.user_id == user_id,
        )
    ).first()
    if weekly:
        return "weekly", weekly
    raise CommandError(
        status_code=404,
        code="mission_not_found",
        message="Mission instance not found",
    )


def start_mission(
    session: Session,
    *,
    user: User,
    mission_instance_id: str,
    idempotency_key: str,
) -> dict[str, Any]:
    command_type = "mission.start"
    replay = idempotency_replay(
        session,
        user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
    )
    if replay:
        return replay

    _cycle, mission = _resolve_mission(session, user_id=user.id, mission_instance_id=mission_instance_id)
    if bool(mission.claimed):
        raise CommandError(
            status_code=409,
            code="mission_not_startable",
            message="Mission is already claimed",
            details={"missionInstanceId": mission.id},
        )

    result = {
        "missionInstanceId": mission.id,
        "status": "in_progress",
        "startedAt": datetime.now(timezone.utc).isoformat(),
    }
    return save_idempotency_result(
        session,
        user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
        response_json=result,
        status_code=200,
    )


def claim_mission_reward(
    session: Session,
    *,
    user: User,
    mission_instance_id: str,
    idempotency_key: str,
) -> dict[str, Any]:
    command_type = "mission.claim"
    replay = idempotency_replay(
        session,
        user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
    )
    if replay:
        return replay

    cycle, mission = _resolve_mission(session, user_id=user.id, mission_instance_id=mission_instance_id)
    if bool(mission.claimed):
        raise CommandError(
            status_code=409,
            code="mission_already_claimed",
            message="Mission already claimed",
            details={"missionInstanceId": mission.id},
        )
    progress_minutes = int(mission.progress_minutes or 0)
    target_minutes = int(mission.target_minutes or 0)
    if progress_minutes < target_minutes:
        raise CommandError(
            status_code=409,
            code="mission_not_completed",
            message="Mission target not reached",
            details={"targetMinutes": target_minutes, "progressMinutes": progress_minutes},
        )

    xp_delta = int(mission.reward_xp) if mission.reward_xp is not None else (50 if cycle == "daily" else 200)
    gold_delta = (
        int(mission.reward_gold) if mission.reward_gold is not None else (25 if cycle == "daily" else 100)
    )

    claim = RewardClaim(
        user_id=user.id,
        mission_cycle=cycle,
        mission_id=mission.id,
        reward_xp=xp_delta,
        reward_gold=gold_delta,
    )
    session.add(claim)
    try:
        session.flush()
    except IntegrityError as exc:
        raise CommandError(
            status_code=409,
            code="mission_already_claimed",
            message="Mission already claimed",
            details={"missionInstanceId": mission.id},
        ) from exc

    mission.claimed = True
    session.add(mission)

    stats, _level_ups = apply_xp_gold(
        session,
        user,
        xp_delta=xp_delta,
        gold_delta=gold_delta,
        autocommit=False,
        persist_ledger=True,
        event_type=f"{cycle}.quest.claim",
        source_type=f"{cycle}_quest",
        source_ref=mission.id,
        payload_json={"missionInstanceId": mission.id},
    )

    result = {
        "claimId": claim.id,
        "reward": {"xp": xp_delta, "gold": gold_delta, "items": []},
        "progress": progress_to_dict(stats),
    }

    return save_idempotency_result(
        session,
        user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
        response_json=result,
        status_code=200,
    )


def _int_payload(payload: dict[str, Any], key: str, *, minimum: int, maximum: int) -> int:
    raw = payload.get(key)
    if isinstance(raw, bool):
        raise ValueError(key)
    try:
        val = int(raw)
    except Exception as exc:
        raise ValueError(key) from exc
    if val < minimum or val > maximum:
        raise ValueError(key)
    return val


def _compute_event_deltas(event_type: str, payload: dict[str, Any]) -> tuple[int, int]:
    if event_type == "video.lesson.completed":
        minutes = _int_payload(payload, "minutes", minimum=1, maximum=360)
        return min(900, minutes * 5), min(240, minutes * 1)

    if event_type == "review.completed":
        reviewed = _int_payload(payload, "reviewed", minimum=1, maximum=300)
        return min(1200, reviewed * 8), min(400, reviewed * 2)

    if event_type == "combat.victory":
        rank = str(payload.get("bossRank", "F")).upper().strip() or "F"
        xp_by_rank = {"F": 80, "E": 100, "D": 130, "C": 170, "B": 220, "A": 280, "S": 360}
        gold_by_rank = {"F": 30, "E": 40, "D": 55, "C": 70, "B": 95, "A": 120, "S": 160}
        return int(xp_by_rank.get(rank, 80)), int(gold_by_rank.get(rank, 30))

    raise CommandError(
        status_code=422,
        code="invalid_event_type",
        message="Unsupported eventType",
        details={"eventType": event_type},
    )


def apply_xp_event(
    session: Session,
    *,
    user: User,
    event_type: str,
    occurred_at: str,
    payload: dict[str, Any],
    idempotency_key: str,
) -> dict[str, Any]:
    command_type = "event.apply_xp"
    replay = idempotency_replay(
        session,
        user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
    )
    if replay:
        return replay

    xp_delta, gold_delta = _compute_event_deltas(event_type, payload)
    source_ref = str(payload.get("sourceRef", "")).strip() or f"{event_type}:{occurred_at}"

    try:
        stats, _level_ups = apply_xp_gold(
            session,
            user,
            xp_delta=xp_delta,
            gold_delta=gold_delta,
            autocommit=False,
            persist_ledger=True,
            event_type=event_type,
            source_type="event",
            source_ref=source_ref,
            payload_json=payload,
        )
    except IntegrityError as exc:
        raise CommandError(
            status_code=409,
            code="duplicate_event",
            message="Event already processed",
            details={"sourceRef": source_ref},
        ) from exc

    ledger_row = session.exec(
        select(XpLedgerEvent).where(
            XpLedgerEvent.user_id == user.id,
            XpLedgerEvent.source_type == "event",
            XpLedgerEvent.source_ref == source_ref,
        )
    ).first()

    result = {
        "eventId": ledger_row.id if ledger_row else None,
        "applied": True,
        "xpDelta": xp_delta,
        "goldDelta": gold_delta,
        "progress": progress_to_dict(stats),
    }
    return save_idempotency_result(
        session,
        user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
        response_json=result,
        status_code=200,
    )


def _streak_days(session: Session, *, user_id: str) -> int:
    today = now_local().date()
    scan_start = (today - timedelta(days=365)).strftime("%Y-%m-%d")
    today_key = today.strftime("%Y-%m-%d")
    rows = session.exec(
        select(
            StudySession.date_key,
            func.coalesce(func.sum(StudySession.minutes), 0),
        )
        .where(
            StudySession.user_id == user_id,
            StudySession.date_key >= scan_start,
            StudySession.date_key <= today_key,
            StudySession.deleted_at.is_(None),
        )
        .group_by(StudySession.date_key)
    ).all()
    by_day = {str(day_key): int(minutes or 0) for day_key, minutes in rows}

    streak = 0
    cursor = today
    while True:
        key = cursor.strftime("%Y-%m-%d")
        if by_day.get(key, 0) <= 0:
            break
        streak += 1
        if streak > 365:
            break
        cursor = cursor - timedelta(days=1)
    return streak


def get_progress_payload(session: Session, *, user: User) -> dict[str, Any]:
    stats = get_or_create_user_stats(session, user)
    return {
        "level": int(stats.level),
        "rank": str(stats.rank or "F"),
        "xp": int(stats.xp),
        "maxXp": int(stats.max_xp),
        "gold": int(stats.gold),
        "streakDays": _streak_days(session, user_id=user.id),
        "vitals": {
            "hp": int(stats.hp),
            "mana": int(stats.mana),
            "fatigue": int(stats.fatigue),
        },
    }


def list_missions_payload(
    session: Session,
    *,
    user: User,
    cycle: Literal["daily", "weekly", "both"] = "both",
    date_value: str | None = None,
) -> dict[str, Any]:
    local_now = now_local()
    day_key = date_value or local_now.strftime("%Y-%m-%d")
    week_value = week_key(local_now)

    daily_rows: list[DailyQuest] = []
    weekly_rows: list[WeeklyQuest] = []
    if cycle in {"daily", "both"}:
        daily_rows = session.exec(
            select(DailyQuest).where(DailyQuest.user_id == user.id, DailyQuest.date_key == day_key)
        ).all()
    if cycle in {"weekly", "both"}:
        weekly_rows = session.exec(
            select(WeeklyQuest).where(WeeklyQuest.user_id == user.id, WeeklyQuest.week_key == week_value)
        ).all()

    return {
        "daily": [
            {
                "missionInstanceId": row.id,
                "cycle": "daily",
                "subject": row.subject,
                "targetMinutes": int(row.target_minutes),
                "progressMinutes": int(row.progress_minutes),
                "claimed": bool(row.claimed),
                "reward": {
                    "xp": int(row.reward_xp) if row.reward_xp is not None else 50,
                    "gold": int(row.reward_gold) if row.reward_gold is not None else 25,
                },
            }
            for row in daily_rows
        ],
        "weekly": [
            {
                "missionInstanceId": row.id,
                "cycle": "weekly",
                "subject": row.subject,
                "targetMinutes": int(row.target_minutes),
                "progressMinutes": int(row.progress_minutes),
                "claimed": bool(row.claimed),
                "reward": {
                    "xp": int(row.reward_xp) if row.reward_xp is not None else 200,
                    "gold": int(row.reward_gold) if row.reward_gold is not None else 100,
                },
            }
            for row in weekly_rows
        ],
    }


def list_xp_history_payload(
    session: Session,
    *,
    user: User,
    date_from: str | None,
    date_to: str | None,
    limit: int = 100,
) -> dict[str, Any]:
    safe_limit = max(1, min(200, int(limit)))
    query = select(XpLedgerEvent).where(XpLedgerEvent.user_id == user.id)
    if date_from:
        from_dt = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        query = query.where(XpLedgerEvent.created_at >= from_dt)
    if date_to:
        to_dt = datetime.strptime(date_to, "%Y-%m-%d").replace(tzinfo=timezone.utc) + timedelta(
            hours=23, minutes=59, seconds=59
        )
        query = query.where(XpLedgerEvent.created_at <= to_dt)

    rows = session.exec(query.order_by(XpLedgerEvent.created_at.desc()).limit(safe_limit)).all()
    return {
        "events": [
            {
                "id": row.id,
                "eventType": row.event_type,
                "sourceType": row.source_type,
                "sourceRef": row.source_ref,
                "xpDelta": int(row.xp_delta),
                "goldDelta": int(row.gold_delta),
                "rulesetVersion": int(row.ruleset_version),
                "createdAt": row.created_at.isoformat(),
            }
            for row in rows
        ]
    }


def leaderboard_payload(
    session: Session,
    *,
    scope: Literal["weekly"] = "weekly",
    limit: int = 50,
) -> dict[str, Any]:
    safe_limit = max(1, min(100, int(limit)))
    since = datetime.now(timezone.utc) - timedelta(days=7 if scope == "weekly" else 7)
    rows = session.exec(
        select(
            XpLedgerEvent.user_id,
            func.coalesce(func.sum(XpLedgerEvent.xp_delta), 0).label("xp_total"),
            func.coalesce(func.sum(XpLedgerEvent.gold_delta), 0).label("gold_total"),
        )
        .where(XpLedgerEvent.created_at >= since)
        .group_by(XpLedgerEvent.user_id)
        .order_by(func.coalesce(func.sum(XpLedgerEvent.xp_delta), 0).desc())
        .limit(safe_limit)
    ).all()

    user_ids = [str(row[0]) for row in rows]
    user_rows = (
        session.exec(select(User.id, User.email).where(User.id.in_(user_ids))).all() if user_ids else []
    )
    email_by_user = {str(user_id): str(email) for user_id, email in user_rows}

    entries: list[dict[str, Any]] = []
    for index, row in enumerate(rows, start=1):
        user_id = str(row[0])
        email = email_by_user.get(user_id, "unknown@example.com")
        entries.append(
            {
                "position": index,
                "userId": user_id,
                "label": email.split("@")[0],
                "xpTotal": int(row[1] or 0),
                "goldTotal": int(row[2] or 0),
            }
        )
    return {"scope": scope, "entries": entries}
