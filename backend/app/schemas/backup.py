from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from .auth import UserOut
from .drills import DrillOut


class BackupSessionOut(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    subject: str = Field(min_length=1, max_length=80)
    minutes: int = Field(ge=1, le=1440)
    mode: str = Field(min_length=2, max_length=32)
    notes: Optional[str] = Field(default=None, max_length=1000)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    startedAt: datetime
    createdAt: datetime


class BackupQuestOut(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    subject: str = Field(min_length=1, max_length=80)
    title: Optional[str] = Field(default=None, max_length=240)
    description: Optional[str] = Field(default=None, max_length=4000)
    rank: Optional[str] = Field(default=None, max_length=24)
    difficulty: Optional[str] = Field(default=None, max_length=32)
    objective: Optional[str] = Field(default=None, max_length=800)
    tags: list[str] = Field(default_factory=list, max_length=100)
    rewardXp: Optional[int] = None
    rewardGold: Optional[int] = None
    source: str = Field(default="fallback", max_length=64)
    generatedAt: Optional[datetime] = None
    targetMinutes: int = Field(ge=0, le=10080)
    progressMinutes: int = Field(ge=0, le=10080)
    claimed: bool


class BackupReviewOut(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    drillId: str = Field(min_length=1, max_length=128)
    nextReviewAt: datetime
    intervalDays: int = Field(ge=0, le=3650)
    ease: float = Field(ge=0.0, le=10.0)
    reps: int = Field(ge=0, le=10000)
    lastResult: Optional[str] = Field(default=None, max_length=32)
    updatedAt: datetime


class BackupOut(BaseModel):
    version: int = 1
    exportedAt: datetime
    user: UserOut
    goals: dict[str, int]
    sessions: list[BackupSessionOut]
    dailyQuests: list[BackupQuestOut]
    drillReviews: list[BackupReviewOut]
    customDrills: list[DrillOut] = []


class BackupImportIn(BaseModel):
    version: int = 1
    goals: dict[str, int] = Field(default_factory=dict)
    sessions: list[BackupSessionOut] = Field(default_factory=list)
    dailyQuests: list[BackupQuestOut] = Field(default_factory=list)
    drillReviews: list[BackupReviewOut] = Field(default_factory=list)
    customDrills: list[DrillOut] = Field(default_factory=list)
