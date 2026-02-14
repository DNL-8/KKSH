from __future__ import annotations

import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.deps import db_session, get_current_user, get_owned_study_block
from app.models import StudyBlock, User
from app.schemas import StudyBlockCreateIn, StudyBlockOut, StudyBlockUpdateIn

router = APIRouter()


_TIME_RE = re.compile(r"^(\d{2}):(\d{2})$")


def _validate_time_hhmm(value: str) -> str:
    m = _TIME_RE.match(value or "")
    if not m:
        raise HTTPException(status_code=400, detail="Invalid startTime")
    hh = int(m.group(1))
    mm = int(m.group(2))
    if hh < 0 or hh > 23 or mm < 0 or mm > 59:
        raise HTTPException(status_code=400, detail="Invalid startTime")
    return f"{hh:02d}:{mm:02d}"


def _to_out(b: StudyBlock) -> StudyBlockOut:
    return StudyBlockOut(
        id=b.id,
        dayOfWeek=int(b.day_of_week),
        startTime=str(b.start_time),
        durationMin=int(b.duration_min),
        subject=str(b.subject),
        mode=str(b.mode),
        isActive=bool(b.is_active),
    )


@router.get("", response_model=list[StudyBlockOut])
def list_study_blocks(
    activeOnly: bool = True,  # noqa: N803 (fastapi query param)
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    stmt = select(StudyBlock).where(StudyBlock.user_id == user.id)
    if activeOnly:
        stmt = stmt.where(StudyBlock.is_active == True)  # noqa: E712
    rows = session.exec(stmt.order_by(StudyBlock.day_of_week, StudyBlock.start_time)).all()
    return [_to_out(r) for r in rows]


@router.post("", response_model=StudyBlockOut, status_code=201)
def create_study_block(
    payload: StudyBlockCreateIn,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    if payload.dayOfWeek < 0 or payload.dayOfWeek > 6:
        raise HTTPException(status_code=400, detail="Invalid dayOfWeek")
    if payload.durationMin < 10 or payload.durationMin > 360:
        raise HTTPException(status_code=400, detail="Invalid durationMin")
    start_time = _validate_time_hhmm(payload.startTime)

    now = datetime.now(timezone.utc)
    b = StudyBlock(
        user_id=user.id,
        day_of_week=int(payload.dayOfWeek),
        start_time=start_time,
        duration_min=int(payload.durationMin),
        subject=str(payload.subject),
        mode=str(payload.mode or "pomodoro"),
        is_active=bool(payload.isActive) if payload.isActive is not None else True,
        created_at=now,
        updated_at=now,
    )
    session.add(b)
    session.commit()
    session.refresh(b)
    return _to_out(b)


@router.patch("/{block_id}", response_model=StudyBlockOut)
def update_study_block(
    payload: StudyBlockUpdateIn,
    b: StudyBlock = Depends(get_owned_study_block),
    session: Session = Depends(db_session),
):
    if payload.dayOfWeek is not None:
        if payload.dayOfWeek < 0 or payload.dayOfWeek > 6:
            raise HTTPException(status_code=400, detail="Invalid dayOfWeek")
        b.day_of_week = int(payload.dayOfWeek)
    if payload.startTime is not None:
        b.start_time = _validate_time_hhmm(payload.startTime)
    if payload.durationMin is not None:
        if payload.durationMin < 10 or payload.durationMin > 360:
            raise HTTPException(status_code=400, detail="Invalid durationMin")
        b.duration_min = int(payload.durationMin)
    if payload.subject is not None:
        b.subject = str(payload.subject)
    if payload.mode is not None:
        b.mode = str(payload.mode)
    if payload.isActive is not None:
        b.is_active = bool(payload.isActive)

    b.updated_at = datetime.now(timezone.utc)
    session.add(b)
    session.commit()
    session.refresh(b)
    return _to_out(b)


@router.delete("/{block_id}", status_code=204)
def delete_study_block(
    b: StudyBlock = Depends(get_owned_study_block),
    session: Session = Depends(db_session),
):
    session.delete(b)
    session.commit()
    return None
