from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class DailyQuestOut(BaseModel):
    id: str
    date: str
    subject: str
    title: Optional[str] = None
    description: Optional[str] = None
    rank: Optional[str] = None
    difficulty: Optional[str] = None
    objective: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    rewardXp: Optional[int] = None
    rewardGold: Optional[int] = None
    source: str = "fallback"
    generatedAt: Optional[datetime] = None
    targetMinutes: int
    progressMinutes: int
    claimed: bool


class WeeklyQuestOut(BaseModel):
    id: str
    week: str
    subject: str
    title: Optional[str] = None
    description: Optional[str] = None
    rank: Optional[str] = None
    difficulty: Optional[str] = None
    objective: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    rewardXp: Optional[int] = None
    rewardGold: Optional[int] = None
    source: str = "fallback"
    generatedAt: Optional[datetime] = None
    targetMinutes: int
    progressMinutes: int
    claimed: bool


MissionCycle = Literal["daily", "weekly", "both"]


class RegenerateMissionsIn(BaseModel):
    cycle: MissionCycle = "both"
    reason: str = Field(default="manual", min_length=1, max_length=120)


class RegenerateMissionsOut(BaseModel):
    source: Literal["gemini", "fallback", "mixed"]
    nextAllowedAt: datetime
    warnings: list[str] = Field(default_factory=list)
    dailyQuests: list[DailyQuestOut] = Field(default_factory=list)
    weeklyQuests: list[WeeklyQuestOut] = Field(default_factory=list)


class MissionStartIn(BaseModel):
    context: dict[str, object] = Field(default_factory=dict)


class MissionStartOut(BaseModel):
    missionInstanceId: str
    status: Literal["in_progress"]
    startedAt: datetime


class ClaimMissionIn(BaseModel):
    reason: Literal["completed", "manual"] = "completed"


class MissionRewardOut(BaseModel):
    xp: int
    gold: int
    items: list[dict[str, object]] = Field(default_factory=list)


class ClaimMissionOut(BaseModel):
    claimId: str
    reward: MissionRewardOut
    progress: "ProgressionOut"


class MissionListItemOut(BaseModel):
    missionInstanceId: str
    cycle: Literal["daily", "weekly"]
    subject: str
    targetMinutes: int
    progressMinutes: int
    claimed: bool
    reward: MissionRewardOut


class MissionListOut(BaseModel):
    daily: list[MissionListItemOut] = Field(default_factory=list)
    weekly: list[MissionListItemOut] = Field(default_factory=list)


# Avoid circular import — ProgressionOut is defined in progression.py
from .progression import ProgressionOut  # noqa: E402, F401

ClaimMissionOut.model_rebuild()
