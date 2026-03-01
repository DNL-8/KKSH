from __future__ import annotations

from dataclasses import dataclass
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

DEFAULT_REWARD_MULTIPLIER_BPS = 10_000


@dataclass(frozen=True)
class SessionVitalsDelta:
    hp_delta: int = 0
    mana_delta: int = 0
    fatigue_delta: int = 0


_SESSION_ACTIVITY_ALIASES: dict[str, str] = {
    # Study-heavy / cognitive effort
    "pomodoro": "study",
    "study": "study",
    "deep_work": "study",
    "lesson": "study",
    # Video learning
    "video_lesson": "video",
    "video": "video",
    # Physical effort
    "workout": "exercise",
    "exercise": "exercise",
    "training": "exercise",
    "cardio": "exercise",
    "gym": "exercise",
    # Recovery
    "rest": "recovery",
    "break": "recovery",
    "walk": "recovery",
    "meditation": "recovery",
    "sleep": "recovery",
}


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


def _normalize_mode(mode: str | None) -> str:
    raw = (mode or "").strip().lower()
    if not raw:
        return "study"
    return raw.replace("-", "_").replace(" ", "_")


def classify_session_activity(mode: str | None) -> str:
    normalized = _normalize_mode(mode)
    return _SESSION_ACTIVITY_ALIASES.get(normalized, "study")


def compute_session_vitals_delta(*, mode: str | None, minutes: int) -> SessionVitalsDelta:
    safe_minutes = max(1, int(minutes))
    activity = classify_session_activity(mode)
    normalized_mode = _normalize_mode(mode)

    # Study (default): mostly mental drain with light physical strain.
    if activity == "study":
        mana_cost = max(2, int(round(safe_minutes * 0.20)))
        hp_cost = max(0, int(round(safe_minutes * 0.05)))
        fatigue_gain = max(1, int(round(safe_minutes * 0.16)))
        return SessionVitalsDelta(
            hp_delta=-hp_cost,
            mana_delta=-mana_cost,
            fatigue_delta=fatigue_gain,
        )

    # Video: mental drain + small sedentary physical tax for longer sessions.
    if activity == "video":
        mana_cost = max(4, int(round(safe_minutes * 0.22)))
        hp_cost = 2 if safe_minutes >= 35 else (1 if safe_minutes >= 20 else 0)
        fatigue_gain = max(1, int(round(safe_minutes * 0.14)))
        return SessionVitalsDelta(
            hp_delta=-hp_cost,
            mana_delta=-mana_cost,
            fatigue_delta=fatigue_gain,
        )

    # Exercise: mostly physical cost with smaller mental load.
    if activity == "exercise":
        hp_cost = max(6, int(round(safe_minutes * 0.33)))
        mana_cost = max(2, int(round(safe_minutes * 0.11)))
        fatigue_gain = max(3, int(round(safe_minutes * 0.40)))
        return SessionVitalsDelta(
            hp_delta=-hp_cost,
            mana_delta=-mana_cost,
            fatigue_delta=fatigue_gain,
        )

    # Recovery: regenerates vitals and lowers fatigue.
    hp_regen = max(4, int(round(safe_minutes * 0.18)))
    mana_regen = max(6, int(round(safe_minutes * 0.24)))
    fatigue_relief = max(4, int(round(safe_minutes * 0.20)))
    if normalized_mode == "sleep" and safe_minutes >= 420:
        hp_regen += 8
        mana_regen += 10
        fatigue_relief += 10
    return SessionVitalsDelta(
        hp_delta=hp_regen,
        mana_delta=mana_regen,
        fatigue_delta=-fatigue_relief,
    )


def apply_reward_multiplier(
    *,
    xp: int,
    gold: int,
    multiplier_bps: int = DEFAULT_REWARD_MULTIPLIER_BPS,
) -> tuple[int, int]:
    safe_multiplier = max(0, int(multiplier_bps))
    scaled_xp = int(round(int(xp) * safe_multiplier / DEFAULT_REWARD_MULTIPLIER_BPS))
    scaled_gold = int(round(int(gold) * safe_multiplier / DEFAULT_REWARD_MULTIPLIER_BPS))
    return max(0, scaled_xp), max(0, scaled_gold)


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
