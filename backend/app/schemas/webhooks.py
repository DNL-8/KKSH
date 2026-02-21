from __future__ import annotations

from datetime import datetime
from typing import Annotated, Optional

from pydantic import BaseModel, Field, StringConstraints, field_validator


WebhookUrl = Annotated[str, StringConstraints(strip_whitespace=True, min_length=8, max_length=2048)]
WebhookEvent = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, min_length=1, max_length=64, pattern=r"^[a-z0-9_.-]+$"
    ),
]
WebhookSecret = Annotated[str, StringConstraints(min_length=8, max_length=256)]

ALLOWED_WEBHOOK_EVENTS = frozenset(
    {
        "session.created",
        "session.updated",
        "session.deleted",
        "drill.reviewed",
        "test",
    }
)


def _normalize_webhook_events(events: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for event in events:
        if event not in ALLOWED_WEBHOOK_EVENTS:
            raise ValueError(f"unsupported webhook event: {event}")
        if event in seen:
            continue
        seen.add(event)
        deduped.append(event)
    return deduped


class WebhookCreateIn(BaseModel):
    url: WebhookUrl
    events: list[WebhookEvent] = Field(default_factory=list, max_length=20)
    secret: Optional[WebhookSecret] = None
    isActive: bool = True

    @field_validator("events")
    @classmethod
    def validate_events(cls, value: list[str]) -> list[str]:
        return _normalize_webhook_events(value)


class WebhookUpdateIn(BaseModel):
    url: Optional[WebhookUrl] = None
    events: Optional[list[WebhookEvent]] = Field(default=None, max_length=20)
    secret: Optional[WebhookSecret] = None
    isActive: Optional[bool] = None

    @field_validator("events")
    @classmethod
    def validate_events(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        if value is None:
            return value
        return _normalize_webhook_events(value)


class WebhookOut(BaseModel):
    id: str
    url: str
    events: list[str]
    isActive: bool
    createdAt: datetime
    updatedAt: datetime
