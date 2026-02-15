from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlmodel import Session, select

from app.models import User, UserSettings, UserStats, XpLedgerEvent


RANK_RULES: tuple[tuple[int, int, str], ...] = (
    (1, 4, "F"),
    (5, 9, "E"),
    (10, 19, "D"),
    (20, 34, "C"),
    (35, 49, "B"),
    (50, 74, "A"),
    (75, 10_000_000, "S"),
)


def rank_from_level(level: int) -> str:
    safe_level = max(1, int(level))
    for min_level, max_level, rank in RANK_RULES:
        if safe_level >= min_level and safe_level <= max_level:
            return rank
    return "F"


def get_or_create_user_stats(
    session: Session,
    user: User,
    *,
    autocommit: bool = True,
) -> UserStats:
    row = session.exec(select(UserStats).where(UserStats.user_id == user.id)).first()
    if row:
        if not getattr(row, "rank", None):
            row.rank = rank_from_level(int(row.level))
            row.updated_at = datetime.now(timezone.utc)
            session.add(row)
            if autocommit:
                session.commit()
                session.refresh(row)
            else:
                session.flush()
        return row
    row = UserStats(
        user_id=user.id,
        rank=rank_from_level(1),
        version=1,
        updated_at=datetime.now(timezone.utc),
    )
    session.add(row)
    if autocommit:
        session.commit()
        session.refresh(row)
    else:
        session.flush()
    return row


def _clamp(n: int, low: int, high: int) -> int:
    return max(low, min(high, n))


def _new_source_ref(source_ref: str | None) -> str:
    if source_ref and source_ref.strip():
        return source_ref.strip()
    return str(uuid4())


def progress_to_dict(stats: UserStats) -> dict[str, int | str]:
    return {
        "level": int(stats.level),
        "rank": str(getattr(stats, "rank", "F") or "F"),
        "xp": int(stats.xp),
        "maxXp": int(stats.max_xp),
        "gold": int(stats.gold),
    }


def apply_xp_gold(
    session: Session,
    user: User,
    xp_delta: int = 0,
    gold_delta: int = 0,
    *,
    autocommit: bool = True,
    persist_ledger: bool = False,
    event_type: str | None = None,
    source_type: str = "generic",
    source_ref: str | None = None,
    payload_json: dict[str, Any] | None = None,
    ruleset_version: int = 1,
) -> tuple[UserStats, int]:
    """Apply XP/gold changes, update rank/version and optionally append ledger rows.

    Returns:
        tuple[UserStats, int]: (updated stats, level_ups)
    """

    xp_delta_i = int(xp_delta)
    gold_delta_i = int(gold_delta)
    stats = get_or_create_user_stats(session, user, autocommit=autocommit)

    stats.gold = max(0, int(stats.gold) + gold_delta_i)
    stats.xp = max(0, int(stats.xp) + xp_delta_i)

    level_ups = 0
    while int(stats.xp) >= int(stats.max_xp) and int(stats.max_xp) > 0:
        stats.xp = int(stats.xp) - int(stats.max_xp)
        stats.level = int(stats.level) + 1
        stats.max_xp = int(round(int(stats.max_xp) * 1.2 + 50))
        level_ups += 1

    stats.rank = rank_from_level(int(stats.level))
    stats.version = max(1, int(getattr(stats, "version", 1)) + 1)
    stats.updated_at = datetime.now(timezone.utc)
    session.add(stats)

    if persist_ledger and (xp_delta_i != 0 or gold_delta_i != 0):
        ledger_row = XpLedgerEvent(
            user_id=user.id,
            event_type=(event_type or "progress.adjustment"),
            source_type=(source_type.strip() or "generic"),
            source_ref=_new_source_ref(source_ref),
            xp_delta=xp_delta_i,
            gold_delta=gold_delta_i,
            ruleset_version=max(1, int(ruleset_version)),
            payload_json=payload_json or {},
        )
        session.add(ledger_row)

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
    stats.version = max(1, int(getattr(stats, "version", 1)) + 1)
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

