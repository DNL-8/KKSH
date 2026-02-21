from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import JSON, Column, ForeignKey, String, Text
from sqlmodel import Field, SQLModel

from .base import utcnow


class UserWebhook(SQLModel, table=True):
    """User-configurable outbound webhooks (integrations).

    Stored as a URL + list of event names (JSON array). Optional secret is encrypted at rest.
    """

    __tablename__ = "user_webhooks"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    url: str = Field(sa_column=Column(String, nullable=False))
    events_json: str = Field(sa_column=Column(Text, nullable=False, default="[]"))
    # Legacy plaintext column kept for backward compatibility/migration.
    secret: Optional[str] = Field(default=None, sa_column=Column(String, nullable=True))
    secret_encrypted: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    secret_key_id: Optional[str] = Field(default=None, sa_column=Column(String(64), nullable=True))
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class WebhookOutbox(SQLModel, table=True):
    """Durable queue for webhook delivery."""

    __tablename__ = "webhook_outbox"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    webhook_id: Optional[str] = Field(
        default=None,
        sa_column=Column(
            String,
            ForeignKey("user_webhooks.id", ondelete="SET NULL"),
            index=True,
            nullable=True,
        ),
    )
    event: str = Field(index=True)
    payload_json: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    status: str = Field(
        default="pending",
        sa_column=Column(String(32), nullable=False, index=True),
    )
    attempt_count: int = Field(default=0)
    next_attempt_at: datetime = Field(default_factory=utcnow, index=True)
    last_attempt_at: Optional[datetime] = Field(default=None)
    delivered_at: Optional[datetime] = Field(default=None, index=True)
    dead_at: Optional[datetime] = Field(default=None, index=True)
    last_status_code: Optional[int] = Field(default=None)
    last_error: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    locked_by: Optional[str] = Field(default=None, index=True)
    locked_until: Optional[datetime] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(default_factory=utcnow, index=True)
