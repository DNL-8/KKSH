from __future__ import annotations

import json
from datetime import timedelta

from sqlmodel import Session, select

from app.models import DailyQuest, StudySession, User, WeeklyQuest
from app.services.mission_generator import build_fallback_missions
from app.services.utils import week_key


def _spec_for_subject(*, subject: str, cycle: str, minutes_hint: int = 15):
    specs = build_fallback_missions(
        goals={subject: max(5, int(minutes_hint or 15))}, cycle=cycle, count=1
    )
    return specs[0]


def ensure_daily_quests(
    *, session: Session, user: User, dk: str, goals: dict[str, int]
) -> list[DailyQuest]:
    existing = session.exec(
        select(DailyQuest).where(DailyQuest.user_id == user.id, DailyQuest.date_key == dk)
    ).all()
    if existing:
        return existing

    specs = build_fallback_missions(goals=goals, cycle="daily", count=5)

    quests: list[DailyQuest] = []
    for spec in specs:
        q = DailyQuest(
            user_id=user.id,
            date_key=dk,
            subject=spec.subject,
            title=spec.title,
            description=spec.description,
            rank=spec.rank,
            difficulty=spec.difficulty,
            objective=spec.objective,
            tags_json=json.dumps(spec.tags),
            reward_xp=spec.reward_xp,
            reward_gold=spec.reward_gold,
            source=spec.source,
            target_minutes=max(5, int(spec.target_minutes)),
        )
        session.add(q)
        quests.append(q)

    session.commit()
    for q in quests:
        session.refresh(q)
    return quests


def ensure_weekly_quests(
    *, session: Session, user: User, wk: str, goals: dict[str, int]
) -> list[WeeklyQuest]:
    existing = session.exec(
        select(WeeklyQuest).where(WeeklyQuest.user_id == user.id, WeeklyQuest.week_key == wk)
    ).all()
    if existing:
        return existing

    specs = build_fallback_missions(goals=goals, cycle="weekly", count=5)

    quests: list[WeeklyQuest] = []
    for spec in specs:
        q = WeeklyQuest(
            user_id=user.id,
            week_key=wk,
            subject=spec.subject,
            title=spec.title,
            description=spec.description,
            rank=spec.rank,
            difficulty=spec.difficulty,
            objective=spec.objective,
            tags_json=json.dumps(spec.tags),
            reward_xp=spec.reward_xp,
            reward_gold=spec.reward_gold,
            source=spec.source,
            target_minutes=max(30, int(spec.target_minutes)),
        )
        session.add(q)
        quests.append(q)

    session.commit()
    for q in quests:
        session.refresh(q)
    return quests


def apply_session_to_quests(*, session: Session, study_session: StudySession) -> None:
    """Update quest progress for a newly created session."""
    dk = study_session.date_key

    # ---- daily ----
    qs = session.exec(
        select(DailyQuest).where(
            DailyQuest.user_id == study_session.user_id,
            DailyQuest.date_key == dk,
            DailyQuest.subject == study_session.subject,
        )
    ).all()
    if not qs:
        # create an ad-hoc quest for this subject to keep UX consistent
        spec = _spec_for_subject(
            subject=study_session.subject, cycle="daily", minutes_hint=int(study_session.minutes)
        )
        q = DailyQuest(
            user_id=study_session.user_id,
            date_key=dk,
            subject=study_session.subject,
            title=spec.title,
            description=spec.description,
            rank=spec.rank,
            difficulty=spec.difficulty,
            objective=spec.objective,
            tags_json=json.dumps(spec.tags),
            reward_xp=spec.reward_xp,
            reward_gold=spec.reward_gold,
            source="fallback",
            target_minutes=max(5, int(study_session.minutes)),
            progress_minutes=int(study_session.minutes),
        )
        session.add(q)
        session.commit()
    else:
        for q in qs:
            q.progress_minutes = int(q.progress_minutes) + int(study_session.minutes)
            session.add(q)
        session.commit()

    # ---- weekly ----
    wk = week_key()
    try:
        # Use the session's date for correct week
        from datetime import datetime

        wk = week_key(datetime.strptime(dk, "%Y-%m-%d"))
    except Exception:
        pass

    wqs = session.exec(
        select(WeeklyQuest).where(
            WeeklyQuest.user_id == study_session.user_id,
            WeeklyQuest.week_key == wk,
            WeeklyQuest.subject == study_session.subject,
        )
    ).all()

    if not wqs:
        spec = _spec_for_subject(
            subject=study_session.subject, cycle="weekly", minutes_hint=int(study_session.minutes)
        )
        wq = WeeklyQuest(
            user_id=study_session.user_id,
            week_key=wk,
            subject=study_session.subject,
            title=spec.title,
            description=spec.description,
            rank=spec.rank,
            difficulty=spec.difficulty,
            objective=spec.objective,
            tags_json=json.dumps(spec.tags),
            reward_xp=spec.reward_xp,
            reward_gold=spec.reward_gold,
            source="fallback",
            target_minutes=max(30, int(study_session.minutes)),
            progress_minutes=int(study_session.minutes),
        )
        session.add(wq)
        session.commit()
        return

    for q in wqs:
        q.progress_minutes = int(q.progress_minutes) + int(study_session.minutes)
        session.add(q)
    session.commit()


def recompute_daily_quests_for_day(
    *, session: Session, user: User, dk: str, goals: dict[str, int]
) -> None:
    """Rebuild quest progress for a day from (non-deleted) sessions.

    Used after editing/deleting a session so progress stays consistent.
    """
    quests = ensure_daily_quests(session=session, user=user, dk=dk, goals=goals)

    # Reset progress
    for q in quests:
        q.progress_minutes = 0
        session.add(q)
    session.commit()

    # Sum minutes by subject for that day
    rows = session.exec(
        select(StudySession.subject, StudySession.minutes).where(
            StudySession.user_id == user.id,
            StudySession.date_key == dk,
            StudySession.deleted_at.is_(None),
        )
    ).all()

    totals: dict[str, int] = {}
    for subj, mins in rows:
        totals[str(subj)] = totals.get(str(subj), 0) + int(mins)

    # Apply to existing quests
    for q in quests:
        if q.subject in totals:
            q.progress_minutes = min(int(q.target_minutes), totals[q.subject])
            session.add(q)

    # Create ad-hoc quests for subjects not covered by the default quests
    existing_subjects = {q.subject for q in quests}
    for subj, total in totals.items():
        if subj in existing_subjects:
            continue
        spec = _spec_for_subject(subject=subj, cycle="daily", minutes_hint=total)
        q = DailyQuest(
            user_id=user.id,
            date_key=dk,
            subject=subj,
            title=spec.title,
            description=spec.description,
            rank=spec.rank,
            difficulty=spec.difficulty,
            objective=spec.objective,
            tags_json=json.dumps(spec.tags),
            reward_xp=spec.reward_xp,
            reward_gold=spec.reward_gold,
            source="fallback",
            target_minutes=max(5, total),
            progress_minutes=min(max(5, total), total),
        )
        session.add(q)

    session.commit()


def recompute_weekly_quests_for_week(
    *, session: Session, user: User, wk: str, goals: dict[str, int]
) -> None:
    """Rebuild weekly quest progress for a week from (non-deleted) sessions."""
    quests = ensure_weekly_quests(session=session, user=user, wk=wk, goals=goals)

    for q in quests:
        q.progress_minutes = 0
        session.add(q)
    session.commit()

    # Week is [wk, wk+6]
    end_key = None
    try:
        from datetime import datetime

        start_date = datetime.strptime(wk, "%Y-%m-%d").date()
        end_date = start_date + timedelta(days=6)
        end_key = end_date.strftime("%Y-%m-%d")
    except Exception:
        end_key = wk

    rows = session.exec(
        select(StudySession.subject, StudySession.minutes).where(
            StudySession.user_id == user.id,
            StudySession.date_key >= wk,
            StudySession.date_key <= end_key,
            StudySession.deleted_at.is_(None),
        )
    ).all()

    totals: dict[str, int] = {}
    for subj, mins in rows:
        totals[str(subj)] = totals.get(str(subj), 0) + int(mins)

    for q in quests:
        if q.subject in totals:
            q.progress_minutes = min(int(q.target_minutes), totals[q.subject])
            session.add(q)

    existing_subjects = {q.subject for q in quests}
    for subj, total in totals.items():
        if subj in existing_subjects:
            continue
        spec = _spec_for_subject(subject=subj, cycle="weekly", minutes_hint=total)
        wq = WeeklyQuest(
            user_id=user.id,
            week_key=wk,
            subject=subj,
            title=spec.title,
            description=spec.description,
            rank=spec.rank,
            difficulty=spec.difficulty,
            objective=spec.objective,
            tags_json=json.dumps(spec.tags),
            reward_xp=spec.reward_xp,
            reward_gold=spec.reward_gold,
            source="fallback",
            target_minutes=max(30, total),
            progress_minutes=min(max(30, total), total),
        )
        session.add(wq)

    session.commit()
