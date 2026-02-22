from __future__ import annotations

from datetime import datetime
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import JSON, Column, ForeignKey, String, UniqueConstraint
from sqlmodel import Field, SQLModel

from .base import utcnow


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    email: str = Field(index=True, unique=True)
    username: Optional[str] = Field(default=None, index=True, unique=True)
    password_hash: str
    onboarding_done: bool = Field(default=False)
    created_at: datetime = Field(default_factory=utcnow)


class UserSettings(SQLModel, table=True):
    __tablename__ = "user_settings"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            unique=True,
            nullable=False,
        )
    )
    daily_target_minutes: int = Field(default=60)
    pomodoro_work_min: int = Field(default=25)
    pomodoro_break_min: int = Field(default=5)
    timezone: str = Field(default="America/Sao_Paulo")
    language: str = Field(default="pt-BR")
    reminder_enabled: bool = Field(default=True)
    reminder_time: str = Field(default="20:00")  # HH:MM local
    reminder_every_min: int = Field(default=5)
    xp_per_minute: int = Field(default=5)
    gold_per_minute: int = Field(default=1)

    # New fields
    gemini_api_key: Optional[str] = Field(default=None)
    agent_personality: str = Field(default="standard")

    updated_at: datetime = Field(default_factory=utcnow)


class UserStats(SQLModel, table=True):
    __tablename__ = "user_stats"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            unique=True,
            nullable=False,
        )
    )
    level: int = Field(default=1)
    xp: int = Field(default=0)
    max_xp: int = Field(default=1000)
    rank: str = Field(default="F", index=True)
    gold: int = Field(default=0)
    version: int = Field(default=1)
    hp: int = Field(default=100)
    max_hp: int = Field(default=100)
    mana: int = Field(default=100)
    max_mana: int = Field(default=100)
    fatigue: int = Field(default=20)
    max_fatigue: int = Field(default=100)
    updated_at: datetime = Field(default_factory=utcnow)


class UserInventory(SQLModel, table=True):
    __tablename__ = "user_inventory"
    __table_args__ = (UniqueConstraint("user_id", "item_id", name="uq_user_inventory_user_item"),)

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    item_id: str = Field(index=True)
    qty: int = Field(default=0)
    updated_at: datetime = Field(default_factory=utcnow)


class SystemRPGStats(SQLModel, table=True):
    __tablename__ = "system_rpg_stats"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            unique=True,
            nullable=False,
        )
    )
    name: str = Field(default="SUNG JIN-WOO")
    xp: int = Field(default=0)
    level: int = Field(default=1)
    hp: int = Field(default=100)
    mana: int = Field(default=100)
    streak: int = Field(default=0)
    active_minutes: int = Field(default=0)
    completed_raids: int = Field(default=0)
    
    # Attributes
    vigor: int = Field(default=10)
    forca: int = Field(default=15)
    agilidade: int = Field(default=8)
    inteligencia: int = Field(default=5)
    
    updated_at: datetime = Field(default_factory=utcnow)
