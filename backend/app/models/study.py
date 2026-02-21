from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import Column, ForeignKey, String
from sqlmodel import Field, SQLModel

from .base import utcnow


class StudyPlan(SQLModel, table=True):
    __tablename__ = "study_plans"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            unique=True,
            nullable=False,
        )
    )
    goals_json: str = Field(default="{}")  # JSON string: {subject: minutes}
    updated_at: datetime = Field(default_factory=utcnow)


class StudySession(SQLModel, table=True):
    __tablename__ = "study_sessions"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    subject: str = Field(index=True)
    minutes: int
    mode: str = Field(default="pomodoro")
    notes: Optional[str] = None
    # gamification
    xp_earned: int = Field(default=0)
    gold_earned: int = Field(default=0)
    started_at: datetime = Field(default_factory=utcnow)
    created_at: datetime = Field(default_factory=utcnow)
    deleted_at: Optional[datetime] = Field(default=None, index=True)
    date_key: str = Field(index=True)  # YYYY-MM-DD (user local)


class Subject(SQLModel, table=True):
    __tablename__ = "subjects"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    name: str = Field(index=True)
    color: Optional[str] = Field(default=None)
    icon: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class StudyBlock(SQLModel, table=True):
    __tablename__ = "study_blocks"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    day_of_week: int = Field(index=True)  # 0=Mon ... 6=Sun
    start_time: str = Field(default="20:00")  # HH:MM
    duration_min: int = Field(default=30)
    subject: str = Field(default="SQL")
    mode: str = Field(default="pomodoro")
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)
