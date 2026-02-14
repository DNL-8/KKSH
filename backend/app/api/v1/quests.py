from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlmodel import Session

from app.core.audit import log_event
from app.core.deps import db_session, get_current_user, get_owned_daily_quest
from app.models import DailyQuest, User
from app.services.progression import apply_xp_gold

router = APIRouter()


@router.post("/{quest_id}/claim", status_code=204)
def claim_quest(
    request: Request,
    quest: DailyQuest = Depends(get_owned_daily_quest),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    if quest.claimed:
        return None
    if int(quest.progress_minutes) < int(quest.target_minutes):
        raise HTTPException(status_code=400, detail="Quest not completed")
    quest.claimed = True
    session.add(quest)
    session.commit()

    # Reward: dynamic by generated mission metadata, with backward-compatible fallback.
    xp_delta = int(quest.reward_xp) if quest.reward_xp is not None else 50
    gold_delta = int(quest.reward_gold) if quest.reward_gold is not None else 25
    apply_xp_gold(session, user, xp_delta=xp_delta, gold_delta=gold_delta)

    log_event(
        session,
        request,
        "quest.claim",
        user=user,
        metadata={"questId": quest.id, "date": quest.date_key},
    )
    return None
