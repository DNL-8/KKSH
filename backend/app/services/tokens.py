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
    If the token was already revoked (potential reuse attack), revoke ALL
    tokens for the user as a security precaution.
    """
    if not settings.persist_refresh_tokens:
        return True

    token_hash = sha256(refresh_token)
    row = session.exec(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    ).first()
    if not row:
        return False

    # Reuse detection: if token was already revoked, revoke entire family
    if row.revoked_at is not None:
        _revoke_all_for_user(session, user_id=row.user_id)
        return False

    return row.expires_at >= utcnow()


def _revoke_all_for_user(session: Session, *, user_id: str) -> int:
    """Revoke ALL refresh tokens for a user (paranoid mode on reuse detection)."""
    from sqlalchemy import update

    now = utcnow()
    stmt = (
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user_id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    result = session.execute(stmt)
    session.commit()
    return result.rowcount


def rotate_refresh_token(session: Session, *, old_token: str, user_id: str, new_token: str) -> None:
    """Revoke old and persist new (only when persistence is enabled)."""
    if not settings.persist_refresh_tokens:
        return
    revoke_refresh_token(session, refresh_token=old_token)
    persist_refresh_token(session, user_id=user_id, refresh_token=new_token)


def cleanup_expired_refresh_tokens(session: Session, *, keep_revoked_days: int = 7) -> int:
    """Delete expired tokens and old revoked tokens using bulk DELETE.

    Returns number of rows deleted.
    """
    if not settings.persist_refresh_tokens:
        return 0

    from sqlalchemy import delete, or_, and_

    now = utcnow()
    revoked_cutoff = now - timedelta(days=keep_revoked_days)

    stmt = delete(RefreshToken).where(
        or_(
            RefreshToken.expires_at < now,
            and_(
                RefreshToken.revoked_at.isnot(None),
                RefreshToken.revoked_at < revoked_cutoff,
            ),
        )
    )
    result = session.execute(stmt)
    session.commit()
    return result.rowcount
