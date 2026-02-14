from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.core.config import settings
from app.models import RefreshToken


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def persist_refresh_token(session: Session, *, user_id: str, refresh_token: str) -> None:
    """Persist refresh tokens (optional).

    If disabled (default), this is a no-op and auth still works purely via JWT cookies.
    """
    if not settings.persist_refresh_tokens:
        return

    expires_at = utcnow() + timedelta(days=settings.refresh_token_expire_days)
    token_hash = sha256(refresh_token)

    row = RefreshToken(user_id=user_id, token_hash=token_hash, expires_at=expires_at)
    session.add(row)
    session.commit()


def revoke_refresh_token(session: Session, *, refresh_token: str) -> None:
    if not settings.persist_refresh_tokens:
        return

    token_hash = sha256(refresh_token)
    row = session.exec(select(RefreshToken).where(RefreshToken.token_hash == token_hash)).first()
    if not row:
        return
    if row.revoked_at is None:
        row.revoked_at = utcnow()
        session.add(row)
        session.commit()


def is_refresh_token_active(session: Session, *, refresh_token: str) -> bool:
    """Return True if refresh token is known + not revoked + not expired.

    If persistence is disabled, always True.
    """
    if not settings.persist_refresh_tokens:
        return True

    token_hash = sha256(refresh_token)
    row = session.exec(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
    ).first()
    if not row:
        return False
    return row.expires_at >= utcnow()


def rotate_refresh_token(session: Session, *, old_token: str, user_id: str, new_token: str) -> None:
    """Revoke old and persist new (only when persistence is enabled)."""
    if not settings.persist_refresh_tokens:
        return
    revoke_refresh_token(session, refresh_token=old_token)
    persist_refresh_token(session, user_id=user_id, refresh_token=new_token)


def cleanup_expired_refresh_tokens(session: Session, *, keep_revoked_days: int = 7) -> int:
    """Delete expired tokens and old revoked tokens.

    Returns number of rows deleted.
    """
    if not settings.persist_refresh_tokens:
        return 0

    now = utcnow()
    revoked_cutoff = now - timedelta(days=keep_revoked_days)

    rows = session.exec(select(RefreshToken)).all()
    to_delete: list[RefreshToken] = []
    for r in rows:
        if r.expires_at < now:
            to_delete.append(r)
        elif r.revoked_at is not None and r.revoked_at < revoked_cutoff:
            to_delete.append(r)

    for r in to_delete:
        session.delete(r)

    if to_delete:
        session.commit()
    return len(to_delete)
