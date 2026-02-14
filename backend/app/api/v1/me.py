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
from app.models import (
    DailyQuest,
    DrillReview,
    StudyBlock,
    StudySession,
    SystemWindowMessage,
    User,
    UserInventory,
    WeeklyQuest,
)
from app.schemas import (
    AppStateOut,
    DailyQuestOut,
    ProgressionOut,
    ResetScope,
    ResetStateIn,
    ResetStateOut,
    StudyBlockOut,
    UserOut,
    UserSettingsOut,
    VitalsOut,
    WeeklyQuestOut,
)
from app.services.inventory import INVENTORY_CATALOG, list_inventory
from app.services.quests import ensure_daily_quests, ensure_weekly_quests
from app.services.utils import date_key, now_local, parse_goals, week_key

router = APIRouter()
_RESET_RULE = Rule(max_requests=6, window_seconds=60)


@router.get("/me")
def me(user: User | None = Depends(get_optional_user)):
    if not user:
        return {"user": None}
    return {"user": UserOut(id=user.id, email=user.email, isAdmin=is_admin(user))}


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

    plan = get_or_create_study_plan(user, session)
    settings_row = get_or_create_user_settings(user, session)
    stats_row = get_or_create_user_stats(user, session)
    goals = parse_goals(plan.goals_json)

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

    quests = ensure_daily_quests(session=session, user=user, dk=today_dk, goals=goals)
    weekly_quests = ensure_weekly_quests(
        session=session,
        user=user,
        wk=week_key(now),
        goals=goals,
    )

    blocks = session.exec(
        select(StudyBlock)
        .where(StudyBlock.user_id == user.id, StudyBlock.is_active == True)  # noqa: E712
        .order_by(StudyBlock.day_of_week, StudyBlock.start_time)
    ).all()

    inventory = list_inventory(session, user)

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
        settings=UserSettingsOut(
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
        ),
        progression=ProgressionOut(
            level=int(stats_row.level),
            xp=int(stats_row.xp),
            maxXp=int(stats_row.max_xp),
            gold=int(stats_row.gold),
        ),
        vitals=VitalsOut(
            hp=int(stats_row.hp),
            maxHp=int(stats_row.max_hp),
            mana=int(stats_row.mana),
            maxMana=int(stats_row.max_mana),
            fatigue=int(stats_row.fatigue),
            maxFatigue=int(stats_row.max_fatigue),
        ),
    )


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

    if "sessions" in normalized:
        session_rows = session.exec(
            select(StudySession).where(StudySession.user_id == user.id)
        ).all()
        for row in session_rows:
            session.delete(row)
        session.commit()
        summary["sessionsDeleted"] = len(session_rows)

    if "sessions" in normalized:
        daily_rows = session.exec(select(DailyQuest).where(DailyQuest.user_id == user.id)).all()
        weekly_rows = session.exec(select(WeeklyQuest).where(WeeklyQuest.user_id == user.id)).all()

        for row in daily_rows:
            session.delete(row)
        for row in weekly_rows:
            session.delete(row)
        session.commit()

        summary["dailyQuestsDeleted"] = len(daily_rows)
        summary["weeklyQuestsDeleted"] = len(weekly_rows)
    elif "missions" in normalized:
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
        session.commit()

        summary["dailyQuestsReset"] = len(daily_rows)
        summary["weeklyQuestsReset"] = len(weekly_rows)

    if "progression" in normalized:
        stats_row = get_or_create_user_stats(user, session)
        stats_row.level = 1
        stats_row.xp = 0
        stats_row.max_xp = 1000
        stats_row.gold = 0
        stats_row.hp = 100
        stats_row.max_hp = 100
        stats_row.mana = 100
        stats_row.max_mana = 100
        stats_row.fatigue = 20
        stats_row.max_fatigue = 100
        stats_row.updated_at = now
        session.add(stats_row)
        session.commit()
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

        session.commit()
        summary["inventoryItemsReset"] = touched

    if "reviews" in normalized:
        review_rows = session.exec(select(DrillReview).where(DrillReview.user_id == user.id)).all()
        for row in review_rows:
            session.delete(row)
        session.commit()
        summary["reviewsDeleted"] = len(review_rows)

    if full_reset:
        history_rows = session.exec(
            select(SystemWindowMessage).where(SystemWindowMessage.user_id == user.id)
        ).all()
        for row in history_rows:
            session.delete(row)
        session.commit()
        summary["systemWindowMessagesDeleted"] = len(history_rows)

    return ResetStateOut(applied=applied, summary=summary)
