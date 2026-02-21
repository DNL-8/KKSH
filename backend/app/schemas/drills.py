from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ReviewQueueItemOut(BaseModel):
    drillId: str
    nextReviewAt: datetime


class ReviewQueueOut(BaseModel):
    due: list[ReviewQueueItemOut]


class DrillReviewIn(BaseModel):
    drillId: str
    result: Literal["good", "again"]
    # optional training meta (for review mode / stats)
    elapsedMs: Optional[int] = Field(default=None, ge=0, le=3_600_000)
    difficulty: Optional[str | int] = None


class DueDrillOut(BaseModel):
    drillId: str
    subject: str
    question: str
    answer: str
    nextReviewAt: datetime
    intervalDays: int
    ease: float
    reps: int


class LegacyDueDrillOut(BaseModel):
    drillId: str
    subject: str
    question: str
    answer: str
    nextReviewAt: datetime
    intervalDays: int
    reps: int
    ease: float


class ReviewStatsOut(BaseModel):
    dueCount: int
    totalAnswered: int
    goodCount: int
    againCount: int
    goodRate: float
    avgTimeMs: Optional[float] = None
    maturity: dict[str, int]


class LegacyReviewStatsOut(BaseModel):
    dueCount: int
    totalAnswered: int
    goodCount: int
    againCount: int
    goodRate: float
    avgTimeMs: Optional[float] = None
    maturity: dict[str, int]


class DrillOut(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    subject: str = Field(min_length=1, max_length=80)
    question: str = Field(min_length=1, max_length=2000)
    answer: str = Field(min_length=1, max_length=8000)
    tags: list[str] = Field(default_factory=list, max_length=100)


class DrillListOut(BaseModel):
    drills: list[DrillOut]
    nextCursor: Optional[str] = None


class DrillCreateIn(BaseModel):
    subject: str = Field(min_length=1, max_length=80)
    question: str = Field(min_length=3, max_length=500)
    answer: str = Field(min_length=1, max_length=2000)
    tags: list[str] = Field(default_factory=list, max_length=100)
    isActive: bool = True


class DrillUpdateIn(BaseModel):
    subject: Optional[str] = Field(default=None, min_length=1, max_length=80)
    question: Optional[str] = Field(default=None, min_length=3, max_length=500)
    answer: Optional[str] = Field(default=None, min_length=1, max_length=2000)
    tags: Optional[list[str]] = None
    isActive: Optional[bool] = None
