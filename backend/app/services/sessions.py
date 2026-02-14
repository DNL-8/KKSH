"""Service layer for study session operations.

Extracts the transaction-heavy business logic from the sessions router into
a dedicated service, following the pattern used by other services (progression,
quests, inventory).

P2 #20: sessions router should be a thin controller delegating to this service.
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session

from app.core.config import settings
from app.models import StudySession, User, UserSettings
from app.services.progression import apply_xp_gold, compute_session_rewards
from app.services.quests import apply_session_to_quests, ensure_quests_for_today
from app.services.webhooks import enqueue_event

logger = logging.getLogger("app")


def create_study_session(
    *,
    db: Session,
    user: User,
    user_settings: UserSettings,
    subject: str,
    minutes: int,
    mode: str,
    notes: str | None = None,
    date_key: str,
    background_tasks: Any = None,
) -> dict[str, Any]:
    """Create a study session with all side-effects (XP, gold, quests, webhooks).

    Returns a dict with keys: session, xp_earned, gold_earned, level_ups.
    """
    # 1. Compute rewards
    xp_earned, gold_earned = compute_session_rewards(user_settings, minutes)

    # 2. Create session row
    now = datetime.now(timezone.utc)
    study_session = StudySession(
        user_id=user.id,
        subject=subject,
        minutes=minutes,
        mode=mode,
        notes=notes,
        date_key=date_key,
        xp_earned=xp_earned,
        gold_earned=gold_earned,
        created_at=now,
        updated_at=now,
    )
    db.add(study_session)
    db.flush()

    # 3. Apply XP/gold
    stats, level_ups = apply_xp_gold(
        db, user, xp_delta=xp_earned, gold_delta=gold_earned, autocommit=False
    )

    # 4. Quests
    try:
        ensure_quests_for_today(
            db, user, user_settings, autocommit=False, today_key=date_key
        )
        apply_session_to_quests(db, user, subject, minutes, today_key=date_key)
    except Exception:
        logger.warning("quest_side_effect_failed", exc_info=True)

    # 5. Commit
    db.commit()
    db.refresh(study_session)

    # 6. Webhook (non-blocking)
    try:
        enqueue_event(
            background_tasks,
            db,
            user.id,
            "session.created",
            {
                "session_id": study_session.id,
                "subject": subject,
                "minutes": minutes,
                "mode": mode,
                "xp_earned": xp_earned,
                "gold_earned": gold_earned,
            },
            commit=True,
        )
    except Exception:
        logger.warning("webhook_enqueue_failed", exc_info=True)

    return {
        "session": study_session,
        "xp_earned": xp_earned,
        "gold_earned": gold_earned,
        "level_ups": level_ups,
    }


def delete_study_session(
    *,
    db: Session,
    user: User,
    study_session: StudySession,
    background_tasks: Any = None,
) -> None:
    """Soft-delete a session and reverse its XP/gold rewards."""
    study_session.deleted_at = datetime.now(timezone.utc)
    db.add(study_session)

    # Reverse rewards
    xp_earned = int(study_session.xp_earned or 0)
    gold_earned = int(study_session.gold_earned or 0)
    if xp_earned or gold_earned:
        apply_xp_gold(
            db, user, xp_delta=-xp_earned, gold_delta=-gold_earned, autocommit=False
        )

    db.commit()

    # Webhook
    try:
        enqueue_event(
            background_tasks,
            db,
            user.id,
            "session.deleted",
            {"session_id": study_session.id},
            commit=True,
        )
    except Exception:
        logger.warning("webhook_enqueue_failed", exc_info=True)
