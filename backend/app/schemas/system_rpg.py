from typing import Optional
from pydantic import BaseModel, ConfigDict


class SystemRPGStatsOut(BaseModel):
    name: str
    xp: int
    level: int
    hp: int
    mana: int
    streak: int
    active_minutes: int
    completed_raids: int
    vigor: int
    forca: int
    agilidade: int
    inteligencia: int

    model_config = ConfigDict(from_attributes=True)


class SystemRPGStatsUpdate(BaseModel):
    name: Optional[str] = None
    xp: Optional[int] = None
    level: Optional[int] = None
    hp: Optional[int] = None
    mana: Optional[int] = None
    streak: Optional[int] = None
    active_minutes: Optional[int] = None
    completed_raids: Optional[int] = None
    vigor: Optional[int] = None
    forca: Optional[int] = None
    agilidade: Optional[int] = None
    inteligencia: Optional[int] = None
