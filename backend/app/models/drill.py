from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Column, ForeignKey, String
from sqlmodel import Field, SQLModel

from .base import utcnow


class Drill(SQLModel, table=True):
    __tablename__ = "drills"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    subject: str = Field(index=True)
    question: str
    answer: str
    tags_json: str = Field(default="[]")  # JSON list[str]
    created_by_user_id: Optional[str] = Field(
        default=None,
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="SET NULL"),
            index=True,
            nullable=True,
        ),
    )
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class DrillReview(SQLModel, table=True):
    __tablename__ = "drill_reviews"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    drill_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("drills.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    next_review_at: datetime = Field(default_factory=utcnow)
    interval_days: int = 1
    ease: float = 2.5
    reps: int = 0
    last_result: Optional[str] = None
    # training stats
    good_count: int = Field(default=0)
    again_count: int = Field(default=0)
    total_time_ms: int = Field(default=0)
    last_time_ms: Optional[int] = Field(default=None)
    last_difficulty: Optional[str] = Field(default=None)
    updated_at: datetime = Field(default_factory=utcnow)
