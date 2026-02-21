from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from .settings import UserSettingsOut


class OnboardingStatusOut(BaseModel):
    onboardingDone: bool
    goals: dict[str, int]
    settings: UserSettingsOut


class OnboardingCompleteIn(BaseModel):
    goals: dict[str, int]
    dailyTargetMinutes: int = Field(ge=10, le=600)
    pomodoroWorkMin: int = Field(ge=10, le=90)
    pomodoroBreakMin: int = Field(ge=3, le=30)
    timezone: str = Field(min_length=3, max_length=64)


class StudyPlanIn(BaseModel):
    goals: dict[str, int]


class StudyPlanOut(BaseModel):
    goals: dict[str, int]


class SubjectOut(BaseModel):
    id: str
    name: str
    color: Optional[str] = None
    icon: Optional[str] = None
    isActive: bool = True
    createdAt: datetime
    updatedAt: datetime


class SubjectListOut(BaseModel):
    subjects: list[SubjectOut]


class SubjectCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    color: Optional[str] = Field(default=None, max_length=32)
    icon: Optional[str] = Field(default=None, max_length=32)
    isActive: bool = True


class SubjectUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=40)
    color: Optional[str] = Field(default=None, max_length=32)
    icon: Optional[str] = Field(default=None, max_length=32)
    isActive: Optional[bool] = None


class LegacyStudyBlockOut(BaseModel):
    id: str
    dayOfWeek: int  # 0=Mon ... 6=Sun
    startTime: str  # HH:MM
    durationMin: int
    subject: str
    mode: str
    isActive: bool = True


class StudyBlockCreateIn(BaseModel):
    dayOfWeek: int = Field(ge=0, le=6)
    startTime: str = Field(min_length=4, max_length=5)
    durationMin: int = Field(ge=10, le=360)
    subject: str = Field(min_length=1, max_length=64)
    mode: str = Field(default="pomodoro", min_length=3, max_length=16)
    isActive: Optional[bool] = None


class StudyBlockUpdateIn(BaseModel):
    dayOfWeek: Optional[int] = Field(default=None, ge=0, le=6)
    startTime: Optional[str] = Field(default=None, min_length=4, max_length=5)
    durationMin: Optional[int] = Field(default=None, ge=10, le=360)
    subject: Optional[str] = Field(default=None, min_length=1, max_length=64)
    mode: Optional[str] = Field(default=None, min_length=3, max_length=16)
    isActive: Optional[bool] = None


class StudyBlockIn(BaseModel):
    dayOfWeek: int = Field(ge=0, le=6)
    startTime: str = Field(min_length=4, max_length=5)
    durationMin: int = Field(ge=10, le=480)
    subject: str
    mode: str = "pomodoro"
    isActive: bool = True


class UpdateStudyBlockIn(BaseModel):
    dayOfWeek: Optional[int] = Field(default=None, ge=0, le=6)
    startTime: Optional[str] = Field(default=None, min_length=4, max_length=5)
    durationMin: Optional[int] = Field(default=None, ge=10, le=480)
    subject: Optional[str] = None
    mode: Optional[str] = None
    isActive: Optional[bool] = None


class RecommendationOut(BaseModel):
    kind: str
    title: str
    description: str
    subject: Optional[str] = None
    cta: Optional[str] = None
