from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select

from app.core.deps import db_session, get_current_user
from app.models.user import SystemRPGStats, User
from app.schemas.system_rpg import SystemRPGStatsOut, SystemRPGStatsUpdate

router = APIRouter(prefix="/system-rpg", tags=["system-rpg"])


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
    for key, value in update_dict.items():
        setattr(stats, key, value)

    session.add(stats)
    session.commit()
    session.refresh(stats)

    return stats
