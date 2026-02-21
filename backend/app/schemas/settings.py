from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from .auth import UserOut
from .progression import InventoryItemOut, ProgressionOut, VitalsOut
from .quests import DailyQuestOut, WeeklyQuestOut


ResetScope = Literal["missions", "progression", "sessions", "inventory", "reviews", "all"]


class UserSettingsOut(BaseModel):
    dailyTargetMinutes: int
    pomodoroWorkMin: int
    pomodoroBreakMin: int
    timezone: str
    # extra settings (defaults for backward compatibility)
    language: str = "pt-BR"
    reminderEnabled: bool = True
    reminderTime: str = "20:00"
    reminderEveryMin: int = 5
    xpPerMinute: int = 5
    goldPerMinute: int = 1

    # New fields
    geminiApiKey: Optional[str] = None
    agentPersonality: str = "standard"


class UpdateSettingsIn(BaseModel):
    dailyTargetMinutes: Optional[int] = Field(default=None, ge=10, le=600)
    pomodoroWorkMin: Optional[int] = Field(default=None, ge=10, le=90)
    pomodoroBreakMin: Optional[int] = Field(default=None, ge=3, le=30)
    timezone: Optional[str] = Field(default=None, min_length=3, max_length=64)
    language: Optional[str] = Field(default=None, min_length=2, max_length=16)
    reminderEnabled: Optional[bool] = None
    reminderTime: Optional[str] = Field(default=None, min_length=4, max_length=5)
    reminderEveryMin: Optional[int] = Field(default=None, ge=1, le=180)
    xpPerMinute: Optional[int] = Field(default=None, ge=0, le=100)
    goldPerMinute: Optional[int] = Field(default=None, ge=0, le=100)
    geminiApiKey: Optional[str] = None
    agentPersonality: Optional[str] = Field(default=None, max_length=32)


class ResetStateIn(BaseModel):
    scopes: list[ResetScope] = Field(default_factory=list)


class ResetStateOut(BaseModel):
    applied: list[ResetScope]
    summary: dict[str, int] = Field(default_factory=dict)


class StudyBlockOut(BaseModel):
    id: str
    dayOfWeek: int
    startTime: str
    durationMin: int
    subject: str
    mode: str
    isActive: bool


class AppStateOut(BaseModel):
    user: UserOut
    onboardingDone: bool = False
    todayMinutes: int
    weekMinutes: int
    streakDays: int
    goals: dict[str, int]
    dueReviews: int
    dailyQuests: list[DailyQuestOut]
    weeklyQuests: list[WeeklyQuestOut] = []
    inventory: list[InventoryItemOut] = []
    studyBlocks: list[StudyBlockOut] = []
    settings: Optional[UserSettingsOut] = None
    progression: Optional[ProgressionOut] = None
    vitals: Optional[VitalsOut] = None
