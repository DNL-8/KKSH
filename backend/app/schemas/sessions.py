from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class CreateSessionIn(BaseModel):
    subject: str
    minutes: int = Field(ge=1, le=1440)
    mode: str = "pomodoro"
    notes: Optional[str] = Field(default=None, max_length=500)


class UpdateSessionIn(BaseModel):
    subject: Optional[str] = None
    minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    mode: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=500)
    date: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")

    @field_validator("date")
    @classmethod
    def validate_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        try:
            return datetime.strptime(value, "%Y-%m-%d").strftime("%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("date must be a valid YYYY-MM-DD") from exc


class SessionOut(BaseModel):
    id: str
    subject: str
    minutes: int
    mode: str
    notes: Optional[str] = None
    date: str
    createdAt: datetime
    # gamification (safe defaults)
    xpEarned: int = 0
    goldEarned: int = 0


class SessionListOut(BaseModel):
    sessions: list[SessionOut]
    nextCursor: Optional[str] = None
