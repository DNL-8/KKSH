from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app.core.deps import db_session, get_current_user, get_owned_subject
from app.models import Subject, User
from app.schemas import SubjectCreateIn, SubjectListOut, SubjectOut, SubjectUpdateIn

router = APIRouter()


def _to_out(s: Subject) -> SubjectOut:
    return SubjectOut(
        id=s.id,
        name=s.name,
        color=s.color,
        icon=s.icon,
        isActive=bool(s.is_active),
        createdAt=s.created_at,
        updatedAt=s.updated_at,
    )


@router.get("", response_model=SubjectListOut)
def list_subjects(session: Session = Depends(db_session), user: User = Depends(get_current_user)):
    items = session.exec(
        select(Subject)
        .where(Subject.user_id == user.id)
        .order_by(Subject.is_active.desc(), Subject.name.asc())
    ).all()
    return SubjectListOut(subjects=[_to_out(s) for s in items])


@router.post("", response_model=SubjectOut, status_code=201)
def create_subject(
    payload: SubjectCreateIn,
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Subject name is required")

    dup = session.exec(
        select(Subject).where(Subject.user_id == user.id).where(Subject.name.ilike(name))
    ).first()
    if dup:
        raise HTTPException(status_code=409, detail="Subject already exists")

    now = datetime.now(timezone.utc)
    subj = Subject(
        user_id=user.id,
        name=name,
        color=payload.color,
        icon=payload.icon,
        is_active=bool(payload.isActive),
        created_at=now,
        updated_at=now,
    )
    session.add(subj)
    session.commit()
    session.refresh(subj)
    return _to_out(subj)


@router.patch("/{subject_id}", response_model=SubjectOut)
def update_subject(
    payload: SubjectUpdateIn,
    subj: Subject = Depends(get_owned_subject),
    session: Session = Depends(db_session),
    user: User = Depends(get_current_user),
):
    if payload.name is not None:
        new_name = payload.name.strip()
        if not new_name:
            raise HTTPException(status_code=400, detail="Subject name is required")
        if new_name.lower() != subj.name.lower():
            dup = session.exec(
                select(Subject)
                .where(Subject.user_id == user.id)
                .where(Subject.name.ilike(new_name))
                .where(Subject.id != subj.id)
            ).first()
            if dup:
                raise HTTPException(status_code=409, detail="Subject already exists")
        subj.name = new_name

    if payload.color is not None:
        subj.color = payload.color
    if payload.icon is not None:
        subj.icon = payload.icon
    if payload.isActive is not None:
        subj.is_active = bool(payload.isActive)

    subj.updated_at = datetime.now(timezone.utc)
    session.add(subj)
    session.commit()
    session.refresh(subj)
    return _to_out(subj)


@router.delete("/{subject_id}", status_code=204)
def delete_subject(
    subj: Subject = Depends(get_owned_subject),
    session: Session = Depends(db_session),
):
    subj.is_active = False
    subj.updated_at = datetime.now(timezone.utc)
    session.add(subj)
    session.commit()
    return None
