from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import JSON, Column, ForeignKey, String
from sqlmodel import Field, SQLModel

from .base import utcnow


class CombatBattle(SQLModel, table=True):
    __tablename__ = "combat_battles"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    module_id: str = Field(index=True)
    status: str = Field(default="ongoing", index=True)  # ongoing | victory | defeat
    turn_state: str = Field(default="PLAYER_IDLE", index=True)
    player_hp: int = Field(default=100)
    player_max_hp: int = Field(default=100)
    enemy_hp: int = Field(default=100)
    enemy_max_hp: int = Field(default=100)
    enemy_rank: str = Field(default="F", index=True)
    current_question_id: Optional[str] = Field(default=None, index=True)
    last_question_id: Optional[str] = Field(default=None, index=True)
    deck_json: list[str] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(default_factory=utcnow, index=True)
