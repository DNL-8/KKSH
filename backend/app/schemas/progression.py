from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ProgressionOut(BaseModel):
    level: int
    rank: str = "F"
    xp: int
    maxXp: int
    gold: int


class ApplyXpEventIn(BaseModel):
    eventType: Literal["video.lesson.completed", "review.completed", "combat.victory"]
    occurredAt: datetime
    sourceRef: Optional[str] = Field(default=None, min_length=3, max_length=180)
    payload: dict[str, object] = Field(default_factory=dict)


class ApplyXpEventOut(BaseModel):
    eventId: Optional[str] = None
    applied: bool = True
    xpDelta: int = 0
    goldDelta: int = 0
    progress: ProgressionOut


class VitalsOut(BaseModel):
    hp: int
    maxHp: int
    mana: int
    maxMana: int
    fatigue: int
    maxFatigue: int


class ProgressQueryOut(BaseModel):
    level: int
    rank: str
    xp: int
    maxXp: int
    gold: int
    streakDays: int
    vitals: dict[str, int]


class XpHistoryEventOut(BaseModel):
    id: str
    eventType: str
    sourceType: str
    sourceRef: str
    xpDelta: int
    goldDelta: int
    rulesetVersion: int
    createdAt: datetime


class XpHistoryOut(BaseModel):
    events: list[XpHistoryEventOut] = Field(default_factory=list)


class InventoryItemOut(BaseModel):
    id: str
    name: str
    desc: str
    qty: int
    consumable: bool


class UseInventoryItemIn(BaseModel):
    itemId: str
    qty: int = Field(default=1, ge=1, le=99)


class UseInventoryItemOut(BaseModel):
    item: InventoryItemOut
    consumedQty: int
    vitals: Optional[VitalsOut] = None
