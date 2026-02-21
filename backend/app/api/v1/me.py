from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlmodel import Session, select

from app.core.deps import (
    db_session,
    get_current_user,
    get_optional_user,
    get_or_create_study_plan,
    get_or_create_user_settings,
    get_or_create_user_stats,
    is_admin,
)
from app.core.rate_limit import Rule, rate_limit
from app.core.secrets import decrypt_secret, encrypt_secret
from app.models import (
    DailyQuest,
    DrillReview,
    StudyBlock,
    StudyPlan,
    StudySession,
    SystemWindowMessage,
    User,
    UserInventory,
    UserSettings,
    UserStats,
    WeeklyQuest,
    XpLedgerEvent,
)
from app.schemas import (
    AppStateOut,
    DailyQuestOut,
    ProgressionOut,
    ResetScope,
    ResetStateIn,
    ResetStateOut,
    StudyBlockOut,
    UpdateSettingsIn,
    UserOut,
    UserSettingsOut,
    UserUpdateIn,
    VitalsOut,
    WeeklyQuestOut,
)
from app.services.inventory import INVENTORY_CATALOG, list_inventory
from app.services.quests import ensure_daily_quests, ensure_weekly_quests
from app.services.utils import date_key, now_local, parse_goals, week_key


def _mask_api_key(key: str | None) -> str | None:
    """Return a masked version of an API key for safe frontend display."""
    if not key or len(key) < 10:
        return None
    return f"{key[:4]}{'*' * (len(key) - 8)}{key[-4:]}"

router = APIRouter()
_RESET_RULE = Rule(max_requests=6, window_seconds=60)


@router.get("/me")
def me(user: User | None = Depends(get_optional_user)):
    if not user:
        return {"user": None}
    return {"user": UserOut(id=user.id, username=user.username, email=user.email, isAdmin=is_admin(user))}


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdateIn,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    if payload.username is not None:
        # Check uniqueness
        # We could rely on DB constraint, but a friendly error is better
        existing = session.exec(select(User).where(User.username == payload.username)).first()
        if existing and existing.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="username_taken"
            )
        user.username = payload.username
    
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserOut(id=user.id, username=user.username, email=user.email, isAdmin=is_admin(user))


def _sum_minutes(session: Session, user: User, dk: str) -> int:
    total = session.exec(
        select(func.coalesce(func.sum(StudySession.minutes), 0)).where(
            StudySession.user_id == user.id,
            StudySession.date_key == dk,
            StudySession.deleted_at.is_(None),
        )
    ).one()
    return int(total or 0)


def _minutes_by_day(
    session: Session,
    user: User,
    *,
    date_from: str,
    date_to: str,
) -> dict[str, int]:
    rows = session.exec(
        select(
            StudySession.date_key,
            func.coalesce(func.sum(StudySession.minutes), 0),
        )
        .where(
            StudySession.user_id == user.id,
            StudySession.date_key >= date_from,
            StudySession.date_key <= date_to,
            StudySession.deleted_at.is_(None),
        )
        .group_by(StudySession.date_key)
    ).all()

    return {str(dk): int(minutes or 0) for dk, minutes in rows}


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


@router.get("/me/state", response_model=AppStateOut)
def state(
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    now = now_local()
    today = now.date()
    today_dk = date_key(now)
    today_minus_6 = today - timedelta(days=6)
    week_start_key = today_minus_6.strftime("%Y-%m-%d")
    streak_scan_start_key = (today - timedelta(days=365)).strftime("%Y-%m-%d")

    plan = session.exec(select(StudyPlan).where(StudyPlan.user_id == user.id)).first()
    settings_row = session.exec(select(UserSettings).where(UserSettings.user_id == user.id)).first()
    stats_row = session.exec(select(UserStats).where(UserStats.user_id == user.id)).first()
    goals = parse_goals(plan.goals_json) if plan else {}

    today_minutes = _sum_minutes(session, user, today_dk)

    # week (last 7 days incl today)
    week_minutes = int(
        session.exec(
            select(func.coalesce(func.sum(StudySession.minutes), 0)).where(
                StudySession.user_id == user.id,
                StudySession.date_key >= week_start_key,
                StudySession.date_key <= today_dk,
                StudySession.deleted_at.is_(None),
            )
        ).one()
        or 0
    )

    # streak: consecutive days ending today with at least 1 minute.
    minutes_by_day = _minutes_by_day(
        session,
        user,
        date_from=streak_scan_start_key,
        date_to=today_dk,
    )
    streak = 0
    cursor = today
    while True:
        k = cursor.strftime("%Y-%m-%d")
        if minutes_by_day.get(k, 0) <= 0:
            break
        streak += 1
        cursor = cursor - timedelta(days=1)
        if streak > 365:
            break

    due_reviews_total = int(
        session.exec(
            select(func.count())
            .select_from(DrillReview)
            .where(
                DrillReview.user_id == user.id,
                DrillReview.next_review_at <= datetime.now(timezone.utc),
            )
        ).one()
        or 0
    )

    quests = session.exec(
        select(DailyQuest).where(
            DailyQuest.user_id == user.id,
            DailyQuest.date_key == today_dk,
        )
    ).all()
    weekly_quests = session.exec(
        select(WeeklyQuest).where(
            WeeklyQuest.user_id == user.id,
            WeeklyQuest.week_key == week_key(now),
        )
    ).all()

    blocks = session.exec(
        select(StudyBlock)
        .where(StudyBlock.user_id == user.id, StudyBlock.is_active == True)  # noqa: E712
        .order_by(StudyBlock.day_of_week, StudyBlock.start_time)
    ).all()

    inventory = list_inventory(session, user, ensure_defaults=False)

    settings_out = (
        UserSettingsOut(
            dailyTargetMinutes=int(settings_row.daily_target_minutes),
            pomodoroWorkMin=int(settings_row.pomodoro_work_min),
            pomodoroBreakMin=int(settings_row.pomodoro_break_min),
            timezone=settings_row.timezone,
            language=settings_row.language,
            reminderEnabled=bool(settings_row.reminder_enabled),
            reminderTime=settings_row.reminder_time,
            reminderEveryMin=int(settings_row.reminder_every_min),
            xpPerMinute=int(settings_row.xp_per_minute),
            goldPerMinute=int(settings_row.gold_per_minute),
            geminiApiKey=_mask_api_key(decrypt_secret(settings_row.gemini_api_key)),
            agentPersonality=settings_row.agent_personality,
        )
        if settings_row
        else UserSettingsOut(
            dailyTargetMinutes=60,
            pomodoroWorkMin=25,
            pomodoroBreakMin=5,
            timezone="America/Sao_Paulo",
            language="pt-BR",
            reminderEnabled=True,
            reminderTime="20:00",
            reminderEveryMin=5,
            xpPerMinute=5,
            goldPerMinute=1,
            geminiApiKey=None,
            agentPersonality="standard",
        )
    )

    progression_out = ProgressionOut(
        level=int(stats_row.level if stats_row else 1),
        rank=str(getattr(stats_row, "rank", "F") or "F"),
        xp=int(stats_row.xp if stats_row else 0),
        maxXp=int(stats_row.max_xp if stats_row else 1000),
        gold=int(stats_row.gold if stats_row else 0),
    )

    vitals_out = VitalsOut(
        hp=int(stats_row.hp if stats_row else 100),
        maxHp=int(stats_row.max_hp if stats_row else 100),
        mana=int(stats_row.mana if stats_row else 100),
        maxMana=int(stats_row.max_mana if stats_row else 100),
        fatigue=int(stats_row.fatigue if stats_row else 20),
        maxFatigue=int(stats_row.max_fatigue if stats_row else 100),
    )

    return AppStateOut(
        user=UserOut(id=user.id, email=user.email, isAdmin=is_admin(user)),
        onboardingDone=bool(getattr(user, "onboarding_done", False)),
        todayMinutes=today_minutes,
        weekMinutes=week_minutes,
        streakDays=streak,
        goals={k: int(v) for k, v in goals.items()},
        dueReviews=due_reviews_total,
        dailyQuests=[
            DailyQuestOut(
                id=q.id,
                date=q.date_key,
                subject=q.subject,
                title=q.title,
                description=q.description,
                rank=q.rank,
                difficulty=q.difficulty,
                objective=q.objective,
                tags=_quest_tags(q.tags_json),
                rewardXp=(int(q.reward_xp) if q.reward_xp is not None else None),
                rewardGold=(int(q.reward_gold) if q.reward_gold is not None else None),
                source=(q.source or "fallback"),
                generatedAt=q.generated_at,
                targetMinutes=int(q.target_minutes),
                progressMinutes=int(q.progress_minutes),
                claimed=bool(q.claimed),
            )
            for q in quests
        ],
        weeklyQuests=[
            WeeklyQuestOut(
                id=q.id,
                week=q.week_key,
                subject=q.subject,
                title=q.title,
                description=q.description,
                rank=q.rank,
                difficulty=q.difficulty,
                objective=q.objective,
                tags=_quest_tags(q.tags_json),
                rewardXp=(int(q.reward_xp) if q.reward_xp is not None else None),
                rewardGold=(int(q.reward_gold) if q.reward_gold is not None else None),
                source=(q.source or "fallback"),
                generatedAt=q.generated_at,
                targetMinutes=int(q.target_minutes),
                progressMinutes=int(q.progress_minutes),
                claimed=bool(q.claimed),
            )
            for q in weekly_quests
        ],
        inventory=inventory,
        studyBlocks=[
            StudyBlockOut(
                id=b.id,
                dayOfWeek=int(b.day_of_week),
                startTime=str(b.start_time),
                durationMin=int(b.duration_min),
                subject=str(b.subject),
                mode=str(b.mode),
                isActive=bool(b.is_active),
            )
            for b in blocks
        ],
        settings=settings_out,
        progression=progression_out,
        vitals=vitals_out,
    )


@router.get("/me/bootstrap", response_model=AppStateOut)
def bootstrap(
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    """Single endpoint for initial app boot — returns all user state in one request.

    Semantically equivalent to ``/me/state`` but intended as the single call
    the frontend issues on startup, reducing multiple sequential requests.
    """
    return state(session=session, user=user)


@router.post(
    "/me/reset",
    response_model=ResetStateOut,
    dependencies=[Depends(rate_limit("me_reset", _RESET_RULE))],
)
def reset_state(
    payload: ResetStateIn,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    requested = [scope for scope in payload.scopes if scope]
    if not requested:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="scopes is required",
        )

    normalized = set(requested)
    full_reset = "all" in normalized
    if "all" in normalized:
        normalized = {"missions", "progression", "sessions", "inventory", "reviews"}

    valid_scopes: set[str] = {"missions", "progression", "sessions", "inventory", "reviews"}
    if not normalized.issubset(valid_scopes):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="invalid scopes",
        )

    scope_order: list[ResetScope] = ["missions", "progression", "sessions", "inventory", "reviews"]
    applied: list[ResetScope] = [scope for scope in scope_order if scope in normalized]
    summary: dict[str, int] = {}
    now = datetime.now(timezone.utc)
    try:
        if "sessions" in normalized:
            session_rows = session.exec(
                select(StudySession).where(StudySession.user_id == user.id)
            ).all()
            for row in session_rows:
                session.delete(row)
            summary["sessionsDeleted"] = len(session_rows)

        if "missions" in normalized:
            daily_rows = session.exec(select(DailyQuest).where(DailyQuest.user_id == user.id)).all()
            weekly_rows = session.exec(select(WeeklyQuest).where(WeeklyQuest.user_id == user.id)).all()

            for row in daily_rows:
                row.progress_minutes = 0
                row.claimed = False
                session.add(row)
            for row in weekly_rows:
                row.progress_minutes = 0
                row.claimed = False
                session.add(row)
            if not daily_rows or not weekly_rows:
                plan = get_or_create_study_plan(user, session, autocommit=False)
                goals = parse_goals(plan.goals_json)
                now_local_dt = now_local()
                if not daily_rows:
                    daily_rows = ensure_daily_quests(
                        session=session,
                        user=user,
                        dk=date_key(now_local_dt),
                        goals=goals,
                        autocommit=False,
                    )
                if not weekly_rows:
                    weekly_rows = ensure_weekly_quests(
                        session=session,
                        user=user,
                        wk=week_key(now_local_dt),
                        goals=goals,
                        autocommit=False,
                    )

            summary["dailyQuestsReset"] = len(daily_rows)
            summary["weeklyQuestsReset"] = len(weekly_rows)

        if "progression" in normalized:
            stats_row = get_or_create_user_stats(session, user, autocommit=False)
            stats_row.level = 1
            stats_row.rank = "F"
            stats_row.xp = 0
            stats_row.max_xp = 1000
            stats_row.gold = 0
            stats_row.version = max(1, int(getattr(stats_row, "version", 1)) + 1)
            stats_row.hp = 100
            stats_row.max_hp = 100
            stats_row.mana = 100
            stats_row.max_mana = 100
            stats_row.fatigue = 20
            stats_row.max_fatigue = 100
            stats_row.updated_at = now
            session.add(stats_row)
            summary["progressionReset"] = 1

        if "inventory" in normalized:
            rows = session.exec(select(UserInventory).where(UserInventory.user_id == user.id)).all()
            by_id = {row.item_id: row for row in rows}

            touched = 0
            for item_id, meta in INVENTORY_CATALOG.items():
                row = by_id.get(item_id)
                default_qty = int(meta["default_qty"])
                if row is None:
                    row = UserInventory(
                        user_id=user.id,
                        item_id=item_id,
                        qty=default_qty,
                        updated_at=now,
                    )
                else:
                    row.qty = default_qty
                    row.updated_at = now
                session.add(row)
                touched += 1

            summary["inventoryItemsReset"] = touched

        if "reviews" in normalized:
            review_rows = session.exec(select(DrillReview).where(DrillReview.user_id == user.id)).all()
            for row in review_rows:
                session.delete(row)
            summary["reviewsDeleted"] = len(review_rows)

        if full_reset:
            history_rows = session.exec(
                select(SystemWindowMessage).where(SystemWindowMessage.user_id == user.id)
            ).all()
            for row in history_rows:
                session.delete(row)
            summary["systemWindowMessagesDeleted"] = len(history_rows)

            ledger_rows = session.exec(
                select(XpLedgerEvent).where(XpLedgerEvent.user_id == user.id)
            ).all()
            for row in ledger_rows:
                session.delete(row)
            summary["xpLedgerEventsDeleted"] = len(ledger_rows)

        session.commit()
    except Exception:
        session.rollback()
        raise

    return ResetStateOut(applied=applied, summary=summary)


@router.patch("/me/settings", response_model=UserSettingsOut)
def update_settings(
    payload: UpdateSettingsIn,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    settings_row = get_or_create_user_settings(user, session)

    if payload.dailyTargetMinutes is not None:
        settings_row.daily_target_minutes = payload.dailyTargetMinutes
    if payload.pomodoroWorkMin is not None:
        settings_row.pomodoro_work_min = payload.pomodoroWorkMin
    if payload.pomodoroBreakMin is not None:
        settings_row.pomodoro_break_min = payload.pomodoroBreakMin
    if payload.timezone is not None:
        settings_row.timezone = payload.timezone
    if payload.language is not None:
        settings_row.language = payload.language
    if payload.reminderEnabled is not None:
        settings_row.reminder_enabled = payload.reminderEnabled
    if payload.reminderTime is not None:
        settings_row.reminder_time = payload.reminderTime
    if payload.reminderEveryMin is not None:
        settings_row.reminder_every_min = payload.reminderEveryMin
    if is_admin(user) and payload.xpPerMinute is not None:
        settings_row.xp_per_minute = payload.xpPerMinute
    if is_admin(user) and payload.goldPerMinute is not None:
        settings_row.gold_per_minute = payload.goldPerMinute
    
    # New fields
    if payload.geminiApiKey is not None:
        # Allow clearing if empty string passed? Or just update if provided.
        # Currently assuming strict string.
        settings_row.gemini_api_key = encrypt_secret(payload.geminiApiKey)
    if payload.agentPersonality is not None:
        settings_row.agent_personality = payload.agentPersonality

    settings_row.updated_at = datetime.now(timezone.utc)
    session.add(settings_row)
    session.commit()
    session.refresh(settings_row)

    return UserSettingsOut(
        dailyTargetMinutes=int(settings_row.daily_target_minutes),
        pomodoroWorkMin=int(settings_row.pomodoro_work_min),
        pomodoroBreakMin=int(settings_row.pomodoro_break_min),
        timezone=settings_row.timezone,
        language=settings_row.language,
        reminderEnabled=bool(settings_row.reminder_enabled),
        reminderTime=settings_row.reminder_time,
        reminderEveryMin=int(settings_row.reminder_every_min),
        xpPerMinute=int(settings_row.xp_per_minute),
        goldPerMinute=int(settings_row.gold_per_minute),
        geminiApiKey=_mask_api_key(decrypt_secret(settings_row.gemini_api_key)),
        agentPersonality=settings_row.agent_personality,
    )
