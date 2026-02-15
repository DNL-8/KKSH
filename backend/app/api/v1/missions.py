from __future__ import annotations

import json
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from sqlmodel import Session, select

from app.core.audit import log_event
from app.core.config import settings
from app.core.deps import db_session, get_current_user, get_or_create_study_plan
from app.core.rate_limit import Rule, rate_limit
from app.models import AuditEvent, DailyQuest, User, UserSettings, WeeklyQuest
from app.schemas import (
    ClaimMissionIn,
    ClaimMissionOut,
    DailyQuestOut,
    MissionListOut,
    MissionStartIn,
    MissionStartOut,
    RegenerateMissionsIn,
    RegenerateMissionsOut,
    WeeklyQuestOut,
)
from app.services.backend_first import (
    CommandError,
    claim_mission_reward,
    list_missions_payload,
    require_idempotency_key,
    start_mission,
)
from app.services.mission_generator import (
    generate_official_mission_specs,
    overwrite_daily_quests,
    overwrite_weekly_quests,
)
from app.services.utils import date_key, now_local, parse_goals, week_key

router = APIRouter(prefix="/missions", tags=["missions"])
_MISSION_REGEN_RULE = Rule(max_requests=8, window_seconds=60)
_MISSION_COMMAND_RULE = Rule(max_requests=20, window_seconds=60)


def _quest_tags(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
    except Exception:
        return []
    if not isinstance(parsed, list):
        return []
    return [str(tag) for tag in parsed if str(tag).strip()][:6]


def _daily_out(row: DailyQuest) -> DailyQuestOut:
    return DailyQuestOut(
        id=row.id,
        date=row.date_key,
        subject=row.subject,
        title=row.title,
        description=row.description,
        rank=row.rank,
        difficulty=row.difficulty,
        objective=row.objective,
        tags=_quest_tags(row.tags_json),
        rewardXp=(int(row.reward_xp) if row.reward_xp is not None else None),
        rewardGold=(int(row.reward_gold) if row.reward_gold is not None else None),
        source=(row.source or "fallback"),
        generatedAt=row.generated_at,
        targetMinutes=int(row.target_minutes),
        progressMinutes=int(row.progress_minutes),
        claimed=bool(row.claimed),
    )


def _weekly_out(row: WeeklyQuest) -> WeeklyQuestOut:
    return WeeklyQuestOut(
        id=row.id,
        week=row.week_key,
        subject=row.subject,
        title=row.title,
        description=row.description,
        rank=row.rank,
        difficulty=row.difficulty,
        objective=row.objective,
        tags=_quest_tags(row.tags_json),
        rewardXp=(int(row.reward_xp) if row.reward_xp is not None else None),
        rewardGold=(int(row.reward_gold) if row.reward_gold is not None else None),
        source=(row.source or "fallback"),
        generatedAt=row.generated_at,
        targetMinutes=int(row.target_minutes),
        progressMinutes=int(row.progress_minutes),
        claimed=bool(row.claimed),
    )


def _last_regen_at(session: Session, user_id: str) -> datetime | None:
    return session.exec(
        select(AuditEvent.created_at)
        .where(AuditEvent.user_id == user_id, AuditEvent.event == "missions.regenerate")
        .order_by(AuditEvent.created_at.desc())
        .limit(1)
    ).first()


def _coerce_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _rate_limited(next_allowed_at: datetime):
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "code": "rate_limited",
            "message": "Mission regeneration cooldown active",
            "details": {
                "scope": "ai_mission_regen",
                "nextAllowedAt": next_allowed_at.isoformat(),
                "cooldownSec": int(settings.ai_mission_regen_cooldown_sec),
            },
        },
    )


@router.get("", response_model=MissionListOut)
def list_missions(
    cycle: str = Query(default="both", pattern="^(daily|weekly|both)$"),
    date: str | None = Query(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    return list_missions_payload(session, user=user, cycle=cycle, date_value=date)


@router.post(
    "/{mission_instance_id}/start",
    response_model=MissionStartOut,
    dependencies=[Depends(rate_limit("mission_start", _MISSION_COMMAND_RULE))],
)
def start_mission_instance(
    mission_instance_id: str,
    payload: MissionStartIn,  # noqa: ARG001 - reserved for future contextual rules
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    key = require_idempotency_key(idempotency_key)
    try:
        result = start_mission(
            session,
            user=user,
            mission_instance_id=mission_instance_id,
            idempotency_key=key,
        )
        log_event(
            session,
            request,
            "mission.start",
            user=user,
            metadata={"missionInstanceId": mission_instance_id},
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
    "/{mission_instance_id}/claim",
    response_model=ClaimMissionOut,
    dependencies=[Depends(rate_limit("mission_claim", _MISSION_COMMAND_RULE))],
)
def claim_mission_instance(
    mission_instance_id: str,
    payload: ClaimMissionIn,  # noqa: ARG001 - reserved for policy extensions
    request: Request,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    key = require_idempotency_key(idempotency_key)
    try:
        result = claim_mission_reward(
            session,
            user=user,
            mission_instance_id=mission_instance_id,
            idempotency_key=key,
        )
        log_event(
            session,
            request,
            "mission.claim",
            user=user,
            metadata={"missionInstanceId": mission_instance_id},
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
    "/regenerate",
    response_model=RegenerateMissionsOut,
    dependencies=[Depends(rate_limit("missions_regenerate", _MISSION_REGEN_RULE))],
)
async def regenerate_missions(
    payload: RegenerateMissionsIn,
    request: Request,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    now_utc = datetime.now(timezone.utc)
    last_at = _coerce_utc(_last_regen_at(session, user.id))
    cooldown_sec = max(1, int(settings.ai_mission_regen_cooldown_sec))

    if last_at is not None:
        next_allowed_at = last_at + timedelta(seconds=cooldown_sec)
        if now_utc < next_allowed_at:
            _rate_limited(next_allowed_at)

    now_local_dt = now_local()
    day_key = date_key(now_local_dt)
    week_key_value = week_key(now_local_dt)

    plan = get_or_create_study_plan(user, session)
    goals = parse_goals(plan.goals_json)

    start_ts = time.perf_counter()

    # Fetch user settings for API Key / Personality
    user_settings_obj = session.exec(
        select(UserSettings).where(UserSettings.user_id == user.id)
    ).first()

    generated = await generate_official_mission_specs(
        goals=goals, cycle=payload.cycle, user_settings=user_settings_obj
    )

    if payload.cycle in {"daily", "both"}:
        daily_rows = overwrite_daily_quests(
            session=session,
            user=user,
            dk=day_key,
            specs=generated.daily,
        )
    else:
        daily_rows = session.exec(
            select(DailyQuest).where(DailyQuest.user_id == user.id, DailyQuest.date_key == day_key)
        ).all()

    if payload.cycle in {"weekly", "both"}:
        weekly_rows = overwrite_weekly_quests(
            session=session,
            user=user,
            wk=week_key_value,
            specs=generated.weekly,
        )
    else:
        weekly_rows = session.exec(
            select(WeeklyQuest).where(
                WeeklyQuest.user_id == user.id, WeeklyQuest.week_key == week_key_value
            )
        ).all()

    next_allowed_at = datetime.now(timezone.utc) + timedelta(seconds=cooldown_sec)
    duration_ms = int((time.perf_counter() - start_ts) * 1000)

    log_event(
        session,
        request,
        "missions.regenerate",
        user=user,
        metadata={
            "cycle": payload.cycle,
            "reason": payload.reason,
            "source": generated.source,
            "warnings": generated.warnings,
            "dailyCount": len(daily_rows),
            "weeklyCount": len(weekly_rows),
            "durationMs": duration_ms,
        },
    )

    return RegenerateMissionsOut(
        source=generated.source,
        warnings=generated.warnings,
        nextAllowedAt=next_allowed_at,
        dailyQuests=[_daily_out(row) for row in daily_rows],
        weeklyQuests=[_weekly_out(row) for row in weekly_rows],
    )
