from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlmodel import Session

from app.core.deps import db_session, get_current_user
from app.models import User
from app.schemas import AchievementOut
from app.services.achievements import list_and_unlock_achievements

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("", response_model=list[AchievementOut])
def list_achievements(
    db: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    data = list_and_unlock_achievements(db, user)
    return data
