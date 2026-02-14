from __future__ import annotations

from datetime import datetime, timezone

from sqlmodel import Session, select

from app.models import Subject, User


def ensure_subjects_from_goals(session: Session, user: User, goals: dict[str, int]) -> None:
    now = datetime.now(timezone.utc)
    existing = {
        s.name.lower(): s
        for s in session.exec(select(Subject).where(Subject.user_id == user.id)).all()
    }

    # Create subjects for keys in goals (even if 0, but keep inactive)
    for name, target in goals.items():
        key = name.lower().strip()
        if not key:
            continue
        if key in existing:
            # keep in sync with 'is_active'
            subj = existing[key]
            desired = bool(int(target) > 0)
            if subj.is_active != desired:
                subj.is_active = desired
                subj.updated_at = now
                session.add(subj)
            continue
        session.add(
            Subject(
                user_id=user.id,
                name=name.strip(),
                is_active=bool(int(target) > 0),
                created_at=now,
                updated_at=now,
            )
        )

    # Caller controls commit to keep transactions consistent.
