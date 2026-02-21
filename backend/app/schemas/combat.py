from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

from .progression import ProgressionOut, VitalsOut


class CombatQuestionOut(BaseModel):
    id: str
    text: str
    options: list[str] = Field(default_factory=list)


class CombatBattleStateOut(BaseModel):
    battleId: str
    playerHp: int
    playerMaxHp: int
    enemyHp: int
    enemyMaxHp: int
    turn: Literal["PLAYER_IDLE", "PLAYER_QUIZ", "VICTORY", "DEFEAT", "ENEMY_TURN", "PLAYER_ATTACKING"]
    status: Literal["ongoing", "victory", "defeat"]


class CombatBossOut(BaseModel):
    name: str
    rank: str
    hp: int


class CombatStartIn(BaseModel):
    moduleId: Optional[str] = None
    reset: bool = False


class CombatStartOut(BaseModel):
    moduleId: str
    boss: CombatBossOut
    battleState: CombatBattleStateOut
    question: Optional[CombatQuestionOut] = None
    progress: ProgressionOut


class CombatQuestionIn(BaseModel):
    battleId: str


class CombatQuestionOutEnvelope(BaseModel):
    battleState: CombatBattleStateOut
    question: CombatQuestionOut


class CombatAnswerIn(BaseModel):
    battleId: str
    questionId: str
    optionIndex: int = Field(ge=0, le=3)


class CombatAnswerOut(BaseModel):
    result: Literal["correct", "incorrect"]
    playerDamage: int
    enemyDamage: int
    battleState: CombatBattleStateOut
    progress: ProgressionOut
