from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import JSON, Column, ForeignKey, String, Text, UniqueConstraint
from sqlmodel import Field, SQLModel

from .base import utcnow


class SystemWindowMessage(SQLModel, table=True):
    __tablename__ = "system_window_messages"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    role: str = Field(default="system", index=True)
    content: str = Field(sa_column=Column(Text, nullable=False))
    source: str = Field(default="gemini", index=True)
    xp_hint: Optional[int] = Field(default=None)
    mission_done_hint: Optional[bool] = Field(default=None)
    status_hint: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow, index=True)


class RefreshToken(SQLModel, table=True):
    """Optional refresh token persistence.

    We don't *require* this for auth to work (JWT cookies still work),
    but when enabled it allows revocation/rotation and a cleanup job.
    """

    __tablename__ = "refresh_tokens"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    token_hash: str = Field(index=True, unique=True)
    expires_at: datetime = Field(index=True)
    revoked_at: Optional[datetime] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utcnow)


class UserAchievement(SQLModel, table=True):
    """Persist unlocked achievements per user.

    Achievements are identified by a stable string key (e.g. "first_session").
    """

    __tablename__ = "user_achievements"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    key: str = Field(index=True)
    unlocked_at: datetime = Field(default_factory=utcnow, index=True)


class AuditEvent(SQLModel, table=True):
    """Append-only audit log for security/forensics.

    Typical events: login, refresh, logout, session.create, quest.claim.
    """

    __tablename__ = "audit_events"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: Optional[str] = Field(
        default=None,
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="SET NULL"),
            index=True,
            nullable=True,
        ),
    )
    event: str = Field(index=True)
    metadata_json: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )
    ip: Optional[str] = Field(default=None, index=True)
    user_agent: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow, index=True)


class XpLedgerEvent(SQLModel, table=True):
    """Immutable XP/Gold ledger for auditing and replay."""

    __tablename__ = "xp_ledger_events"
    __table_args__ = (
        UniqueConstraint("user_id", "source_type", "source_ref", name="uq_xp_ledger_source"),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    event_type: str = Field(index=True)
    source_type: str = Field(default="generic", index=True)
    source_ref: str = Field(default_factory=lambda: str(uuid4()), index=True)
    xp_delta: int = Field(default=0)
    gold_delta: int = Field(default=0)
    ruleset_version: int = Field(default=1, index=True)
    payload_json: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utcnow, index=True)


class CommandIdempotency(SQLModel, table=True):
    """Persist command outcomes keyed by user + command + idempotency key."""

    __tablename__ = "command_idempotency"
    __table_args__ = (
        UniqueConstraint("user_id", "command_type", "idempotency_key", name="uq_command_idempotency"),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    command_type: str = Field(index=True)
    idempotency_key: str = Field(index=True)
    response_json: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    status_code: int = Field(default=200)
    created_at: datetime = Field(default_factory=utcnow, index=True)
