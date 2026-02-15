from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.core.audit import log_event
from app.core.deps import db_session, get_current_user, get_owned_daily_quest
from app.models import DailyQuest, RewardClaim, User
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

    xp_delta = int(quest.reward_xp) if quest.reward_xp is not None else 50
    gold_delta = int(quest.reward_gold) if quest.reward_gold is not None else 25
    try:
        claim = RewardClaim(
            user_id=user.id,
            mission_cycle="daily",
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
            event_type="daily.quest.claim",
            source_type="daily_quest",
            source_ref=quest.id,
            payload_json={"questId": quest.id, "date": quest.date_key},
        )

        log_event(
            session,
            request,
            "quest.claim",
            user=user,
            metadata={"questId": quest.id, "date": quest.date_key},
            commit=False,
        )
        session.commit()
    except IntegrityError:
        session.rollback()
        # Unique reward claim hit by race/retry; keep legacy idempotent behavior.
        return None
    except Exception:
        session.rollback()
        raise
    return None
