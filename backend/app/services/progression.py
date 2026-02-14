from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Session, select

from app.models import User, UserSettings, UserStats


def get_or_create_user_stats(
    session: Session,
    user: User,
    *,
    autocommit: bool = True,
) -> UserStats:
    row = session.exec(select(UserStats).where(UserStats.user_id == user.id)).first()
    if row:
        return row
    row = UserStats(user_id=user.id, updated_at=datetime.now(timezone.utc))
    session.add(row)
    if autocommit:
        session.commit()
        session.refresh(row)
    else:
        session.flush()
    return row


def _clamp(n: int, low: int, high: int) -> int:
    return max(low, min(high, n))


def apply_xp_gold(
    session: Session,
    user: User,
    xp_delta: int = 0,
    gold_delta: int = 0,
    *,
    autocommit: bool = True,
) -> tuple[UserStats, int]:
    """Apply XP & gold deltas and handle level-ups.

    Returns (stats, levelUps).
    """
    stats = get_or_create_user_stats(session, user, autocommit=autocommit)

    stats.gold = max(0, int(stats.gold) + int(gold_delta))
    stats.xp = max(0, int(stats.xp) + int(xp_delta))

    level_ups = 0
    # Level up while XP reaches max_xp
    while int(stats.xp) >= int(stats.max_xp) and int(stats.max_xp) > 0:
        stats.xp = int(stats.xp) - int(stats.max_xp)
        stats.level = int(stats.level) + 1
        # A simple curve
        stats.max_xp = int(round(int(stats.max_xp) * 1.2 + 50))
        level_ups += 1

    stats.updated_at = datetime.now(timezone.utc)
    session.add(stats)
    if autocommit:
        session.commit()
        session.refresh(stats)
    else:
        session.flush()
    return stats, level_ups


def apply_vitals(
    session: Session,
    user: User,
    *,
    hp_delta: int = 0,
    mana_delta: int = 0,
    fatigue_delta: int = 0,
    autocommit: bool = True,
) -> UserStats:
    stats = get_or_create_user_stats(session, user, autocommit=autocommit)
    stats.hp = _clamp(int(stats.hp) + int(hp_delta), 0, int(stats.max_hp))
    stats.mana = _clamp(int(stats.mana) + int(mana_delta), 0, int(stats.max_mana))
    stats.fatigue = _clamp(int(stats.fatigue) + int(fatigue_delta), 0, int(stats.max_fatigue))
    stats.updated_at = datetime.now(timezone.utc)
    session.add(stats)
    if autocommit:
        session.commit()
        session.refresh(stats)
    else:
        session.flush()
    return stats


def compute_session_rewards(settings: UserSettings, minutes: int) -> tuple[int, int]:
    xp = int(minutes) * int(getattr(settings, "xp_per_minute", 5))
    gold = int(minutes) * int(getattr(settings, "gold_per_minute", 1))
    return max(0, xp), max(0, gold)
