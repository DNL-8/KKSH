from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.core.audit import log_event
from app.core.deps import db_session, get_current_user, get_owned_weekly_quest
from app.models import RewardClaim, User, WeeklyQuest
from app.services.progression import apply_xp_gold

router = APIRouter()


@router.post("/{quest_id}/claim", status_code=204)
def claim_weekly_quest(
    request: Request,
    quest: WeeklyQuest = Depends(get_owned_weekly_quest),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    if quest.claimed:
        return None
    if int(quest.progress_minutes) < int(quest.target_minutes):
        raise HTTPException(status_code=400, detail="Quest not completed")
    xp_delta = int(quest.reward_xp) if quest.reward_xp is not None else 200
    gold_delta = int(quest.reward_gold) if quest.reward_gold is not None else 100
    try:
        claim = RewardClaim(
            user_id=user.id,
            mission_cycle="weekly",
            mission_id=quest.id,
            reward_xp=xp_delta,
            reward_gold=gold_delta,
        )
        session.add(claim)
        session.flush()

        quest.claimed = True
        session.add(quest)

        apply_xp_gold(
            session,
            user,
            xp_delta=xp_delta,
            gold_delta=gold_delta,
            autocommit=False,
            persist_ledger=True,
            event_type="weekly.quest.claim",
            source_type="weekly_quest",
            source_ref=quest.id,
            payload_json={"questId": quest.id, "week": quest.week_key},
        )

        log_event(
            session,
            request,
            "weekly_quest.claim",
            user=user,
            metadata={"questId": quest.id, "week": quest.week_key},
            commit=False,
        )
        session.commit()
    except IntegrityError:
        session.rollback()
        return None
    except Exception:
        session.rollback()
        raise
    return None
