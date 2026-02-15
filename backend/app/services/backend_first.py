from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal
from uuid import uuid4

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.config import settings
from app.models import (
    CombatBattle,
    CommandIdempotency,
    DailyQuest,
    DrillReview,
    RewardClaim,
    StudySession,
    User,
    UserStats,
    WeeklyQuest,
    XpLedgerEvent,
)
from app.services.progression import apply_xp_gold, progress_to_dict, rank_from_level
from app.services.utils import now_local, week_key

MissionCycle = Literal["daily", "weekly"]
EVENT_MAX_AGE_DAYS = 7
EVENT_MAX_FUTURE_SECONDS = 300
EVENT_DAILY_CAPS: dict[str, dict[str, int]] = {
    "video.lesson.completed": {"xp": 1800, "gold": 360},
    "review.completed": {"xp": 2400, "gold": 800},
    "combat.victory": {"xp": 1200, "gold": 480},
}


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
        if settings.ff_enforce_idempotency:
            raise CommandError(
                status_code=422,
                code="idempotency_key_required",
                message="Idempotency-Key header is required",
            )
        return f"legacy-{uuid4()}"
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


def _normalize_event_occurred_at(occurred_at: datetime) -> datetime:
    if occurred_at.tzinfo is None:
        raise CommandError(
            status_code=422,
            code="invalid_event_payload",
            message="occurredAt must include timezone information",
            details={"field": "occurredAt"},
        )

    normalized = occurred_at.astimezone(timezone.utc)
    now_utc = datetime.now(timezone.utc)
    if normalized > now_utc + timedelta(seconds=EVENT_MAX_FUTURE_SECONDS):
        raise CommandError(
            status_code=422,
            code="invalid_event_payload",
            message="occurredAt is too far in the future",
            details={"field": "occurredAt", "maxFutureSec": EVENT_MAX_FUTURE_SECONDS},
        )
    if normalized < now_utc - timedelta(days=EVENT_MAX_AGE_DAYS):
        raise CommandError(
            status_code=422,
            code="invalid_event_payload",
            message="occurredAt is too old",
            details={"field": "occurredAt", "maxAgeDays": EVENT_MAX_AGE_DAYS},
        )
    return normalized


def _normalize_source_ref(source_ref: str | None, payload: dict[str, Any]) -> str:
    top_level = (source_ref or "").strip()
    payload_source = str(payload.get("sourceRef", "")).strip()

    if top_level and payload_source and payload_source != top_level:
        raise CommandError(
            status_code=422,
            code="invalid_event_payload",
            message="sourceRef mismatch between top-level and payload",
            details={"field": "sourceRef"},
        )

    resolved = top_level or payload_source
    if not resolved:
        raise CommandError(
            status_code=422,
            code="invalid_event_payload",
            message="sourceRef is required",
            details={"field": "sourceRef"},
        )
    if len(resolved) > 180:
        raise CommandError(
            status_code=422,
            code="invalid_event_payload",
            message="sourceRef is too long",
            details={"field": "sourceRef", "maxLength": 180},
        )
    if any(ch.isspace() for ch in resolved):
        raise CommandError(
            status_code=422,
            code="invalid_event_payload",
            message="sourceRef cannot contain whitespace",
            details={"field": "sourceRef"},
        )
    return resolved


def _require_ref_target(source_ref: str, expected_prefix: str) -> str:
    prefix = f"{expected_prefix}:"
    if not source_ref.startswith(prefix):
        raise CommandError(
            status_code=422,
            code="invalid_source_ref",
            message=f"sourceRef must use '{prefix}<id>' format",
            details={"sourceRef": source_ref},
        )
    target_id = source_ref[len(prefix) :].strip()
    if not target_id:
        raise CommandError(
            status_code=422,
            code="invalid_source_ref",
            message="sourceRef target is empty",
            details={"sourceRef": source_ref},
        )
    return target_id


def _verify_source_ref(
    session: Session,
    *,
    user_id: str,
    event_type: str,
    source_ref: str,
) -> None:
    if event_type == "video.lesson.completed":
        session_id = _require_ref_target(source_ref, "session")
        exists = session.exec(
            select(StudySession.id).where(
                StudySession.id == session_id,
                StudySession.user_id == user_id,
                StudySession.deleted_at.is_(None),
            )
        ).first()
        if not exists:
            raise CommandError(
                status_code=422,
                code="invalid_source_ref",
                message="Referenced session does not exist",
                details={"sourceRef": source_ref},
            )
        return

    if event_type == "review.completed":
        review_id = _require_ref_target(source_ref, "review")
        exists = session.exec(
            select(DrillReview.id).where(
                DrillReview.id == review_id,
                DrillReview.user_id == user_id,
            )
        ).first()
        if not exists:
            raise CommandError(
                status_code=422,
                code="invalid_source_ref",
                message="Referenced review does not exist",
                details={"sourceRef": source_ref},
            )
        return

    if event_type == "combat.victory":
        battle_id = _require_ref_target(source_ref, "battle")
        battle = session.exec(
            select(CombatBattle).where(
                CombatBattle.id == battle_id,
                CombatBattle.user_id == user_id,
            )
        ).first()
        if not battle or battle.status != "victory":
            raise CommandError(
                status_code=422,
                code="invalid_source_ref",
                message="Referenced battle is not a valid victory",
                details={"sourceRef": source_ref},
            )
        return

    raise CommandError(
        status_code=422,
        code="invalid_event_type",
        message="Unsupported eventType",
        details={"eventType": event_type},
    )


def _enforce_daily_event_cap(
    session: Session,
    *,
    user_id: str,
    event_type: str,
    xp_delta: int,
    gold_delta: int,
) -> None:
    caps = EVENT_DAILY_CAPS.get(event_type)
    if not caps:
        return

    now_utc = datetime.now(timezone.utc)
    day_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end = day_start + timedelta(days=1)

    totals = session.exec(
        select(
            func.coalesce(func.sum(XpLedgerEvent.xp_delta), 0),
            func.coalesce(func.sum(XpLedgerEvent.gold_delta), 0),
        ).where(
            XpLedgerEvent.user_id == user_id,
            XpLedgerEvent.source_type == "event",
            XpLedgerEvent.event_type == event_type,
            XpLedgerEvent.created_at >= day_start,
            XpLedgerEvent.created_at < day_end,
        )
    ).one()
    xp_today = int(totals[0] or 0)
    gold_today = int(totals[1] or 0)

    if xp_today + int(xp_delta) > int(caps["xp"]) or gold_today + int(gold_delta) > int(caps["gold"]):
        raise CommandError(
            status_code=429,
            code="event_daily_cap_exceeded",
            message="Daily event reward cap exceeded",
            details={
                "eventType": event_type,
                "dailyCap": {"xp": int(caps["xp"]), "gold": int(caps["gold"])},
                "current": {"xp": xp_today, "gold": gold_today},
            },
        )


def apply_xp_event(
    session: Session,
    *,
    user: User,
    event_type: str,
    occurred_at: datetime,
    payload: dict[str, Any],
    source_ref: str | None,
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

    normalized_occurred_at = _normalize_event_occurred_at(occurred_at)
    normalized_source_ref = _normalize_source_ref(source_ref, payload)
    _verify_source_ref(
        session,
        user_id=user.id,
        event_type=event_type,
        source_ref=normalized_source_ref,
    )

    xp_delta, gold_delta = _compute_event_deltas(event_type, payload)
    _enforce_daily_event_cap(
        session,
        user_id=user.id,
        event_type=event_type,
        xp_delta=xp_delta,
        gold_delta=gold_delta,
    )
    payload_with_source = dict(payload)
    payload_with_source["sourceRef"] = normalized_source_ref

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
            source_ref=normalized_source_ref,
            payload_json={
                **payload_with_source,
                "occurredAt": normalized_occurred_at.isoformat(),
            },
        )
    except IntegrityError as exc:
        raise CommandError(
            status_code=409,
            code="duplicate_event",
            message="Event already processed",
            details={"sourceRef": normalized_source_ref},
        ) from exc

    ledger_row = session.exec(
        select(XpLedgerEvent).where(
            XpLedgerEvent.user_id == user.id,
            XpLedgerEvent.source_type == "event",
            XpLedgerEvent.source_ref == normalized_source_ref,
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
    stats = session.exec(select(UserStats).where(UserStats.user_id == user.id)).first()
    level = int(stats.level) if stats else 1
    rank = str(getattr(stats, "rank", "") or rank_from_level(level))
    xp = int(stats.xp) if stats else 0
    max_xp = int(stats.max_xp) if stats else 1000
    gold = int(stats.gold) if stats else 0
    hp = int(stats.hp) if stats else 100
    mana = int(stats.mana) if stats else 100
    fatigue = int(stats.fatigue) if stats else 20

    return {
        "level": level,
        "rank": rank,
        "xp": xp,
        "maxXp": max_xp,
        "gold": gold,
        "streakDays": _streak_days(session, user_id=user.id),
        "vitals": {
            "hp": hp,
            "mana": mana,
            "fatigue": fatigue,
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
