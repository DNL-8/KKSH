from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Column, ForeignKey, String, UniqueConstraint
from sqlmodel import Field, SQLModel

from .base import utcnow


class DailyQuest(SQLModel, table=True):
    __tablename__ = "daily_quests"
    __table_args__ = (UniqueConstraint("user_id", "date_key", "subject", name="uq_daily_quest"),)

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    date_key: str = Field(index=True)
    subject: str
    target_minutes: int
    progress_minutes: int = 0
    claimed: bool = False
    title: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default=None)
    rank: Optional[str] = Field(default=None, index=True)
    difficulty: Optional[str] = Field(default=None)
    objective: Optional[str] = Field(default=None)
    tags_json: str = Field(default="[]")
    reward_xp: Optional[int] = Field(default=None)
    reward_gold: Optional[int] = Field(default=None)
    source: str = Field(default="fallback", index=True)
    generated_at: datetime = Field(default_factory=utcnow, index=True)
    created_at: datetime = Field(default_factory=utcnow)


class WeeklyQuest(SQLModel, table=True):
    __tablename__ = "weekly_quests"
    __table_args__ = (UniqueConstraint("user_id", "week_key", "subject", name="uq_weekly_quest"),)

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    week_key: str = Field(index=True)  # YYYY-MM-DD (week start, user local)
    subject: str
    target_minutes: int
    progress_minutes: int = 0
    claimed: bool = False
    title: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default=None)
    rank: Optional[str] = Field(default=None, index=True)
    difficulty: Optional[str] = Field(default=None)
    objective: Optional[str] = Field(default=None)
    tags_json: str = Field(default="[]")
    reward_xp: Optional[int] = Field(default=None)
    reward_gold: Optional[int] = Field(default=None)
    source: str = Field(default="fallback", index=True)
    generated_at: datetime = Field(default_factory=utcnow, index=True)
    created_at: datetime = Field(default_factory=utcnow)


class RewardClaim(SQLModel, table=True):
    """Track claim operations and guarantee one claim per mission instance."""

    __tablename__ = "reward_claims"
    __table_args__ = (
        UniqueConstraint("user_id", "mission_cycle", "mission_id", name="uq_reward_claim"),
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
    mission_cycle: str = Field(index=True)  # daily | weekly
    mission_id: str = Field(index=True)
    reward_xp: int = Field(default=0)
    reward_gold: int = Field(default=0)
    created_at: datetime = Field(default_factory=utcnow, index=True)
