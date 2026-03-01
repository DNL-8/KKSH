from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.deps import db_session, get_current_user
from app.models.user import SystemRPGStats, User
from app.schemas.system_rpg import SystemRPGStatsOut, SystemRPGStatsUpdate

router = APIRouter(prefix="/system-rpg", tags=["system-rpg"])

_SYSTEM_RPG_RANK_THRESHOLDS: tuple[int, ...] = (0, 800, 2500, 5000, 8000, 11500, 15000)


def _level_from_xp(xp: int) -> int:
    safe_xp = max(0, int(xp))
    level = 1
    for idx, threshold in enumerate(_SYSTEM_RPG_RANK_THRESHOLDS, start=1):
        if safe_xp >= threshold:
            level = idx
    return level


@router.get("", response_model=SystemRPGStatsOut)
def get_system_rpg_stats(
    *,
    session: Session = Depends(db_session),
    current_user: User = Depends(get_current_user),
) -> SystemRPGStats:
    """Read the current user's System RPG stats."""
    
    statement = select(SystemRPGStats).where(SystemRPGStats.user_id == current_user.id)
    stats = session.exec(statement).first()

    if not stats:
        # Auto-create if not exists
        stats = SystemRPGStats(user_id=current_user.id)
        stats.level = _level_from_xp(int(stats.xp or 0))
        session.add(stats)
        session.commit()
        session.refresh(stats)
    else:
        resolved_level = _level_from_xp(int(stats.xp or 0))
        if int(stats.level or 1) != resolved_level:
            stats.level = resolved_level
            session.add(stats)
            session.commit()
            session.refresh(stats)

    return stats


@router.patch("", response_model=SystemRPGStatsOut)
def update_system_rpg_stats(
    *,
    session: Session = Depends(db_session),
    current_user: User = Depends(get_current_user),
    update_data: SystemRPGStatsUpdate,
) -> SystemRPGStats:
    """Update the current user's System RPG stats."""
    
    statement = select(SystemRPGStats).where(SystemRPGStats.user_id == current_user.id)
    stats = session.exec(statement).first()

    if not stats:
        stats = SystemRPGStats(user_id=current_user.id)
        session.add(stats)

    update_dict = update_data.model_dump(exclude_unset=True)
    if "xp" in update_dict:
        update_dict["xp"] = max(0, int(update_dict["xp"] or 0))
        update_dict["level"] = _level_from_xp(int(update_dict["xp"]))
    elif "level" in update_dict:
        update_dict["level"] = max(1, int(update_dict["level"] or 1))

    for key, value in update_dict.items():
        setattr(stats, key, value)

    session.add(stats)
    session.commit()
    session.refresh(stats)

    return stats
