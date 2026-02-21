# Schemas for reports, leaderboard, and achievements

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class WeeklyReportDayOut(BaseModel):
    date: str
    minutes: int


class WeeklyReportSubjectOut(BaseModel):
    subject: str
    minutes: int


class WeeklyReportOut(BaseModel):
    from_: str = Field(alias="from")
    to: str
    totalMinutes: int
    byDay: list[WeeklyReportDayOut]
    bySubject: list[WeeklyReportSubjectOut]
    streakDays: int


class MonthlyReportRowOut(BaseModel):
    month: str  # YYYY-MM
    minutes: int
    sessions: int = 0
    xp: int = 0
    gold: int = 0


class MonthlyReportOut(BaseModel):
    months: list[MonthlyReportRowOut]


class LeaderboardEntryOut(BaseModel):
    position: int
    userId: str
    label: str
    xpTotal: int
    goldTotal: int


class LeaderboardOut(BaseModel):
    scope: Literal["weekly"] = "weekly"
    entries: list[LeaderboardEntryOut] = Field(default_factory=list)


class AchievementOut(BaseModel):
    key: str
    name: str
    description: str
    icon: Optional[str] = None
    unlocked: bool
    unlockedAt: Optional[datetime] = None  # datetime
