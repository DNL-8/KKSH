from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from sqlalchemy import JSON, Column, ForeignKey, String, Text, UniqueConstraint
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


# NOTE:
# We use explicit ForeignKey constraints (with ON DELETE CASCADE) to keep data consistent.
# This is important because many rows are user-scoped.
#
# SQLite (tests) supports FKs but may require PRAGMA foreign_keys=ON; Postgres will enforce by default.


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    email: str = Field(index=True, unique=True)
    username: Optional[str] = Field(default=None, index=True, unique=True)
    password_hash: str
    onboarding_done: bool = Field(default=False)
    created_at: datetime = Field(default_factory=utcnow)


class StudyPlan(SQLModel, table=True):
    __tablename__ = "study_plans"

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
    goals_json: str = Field(default="{}")  # JSON string: {subject: minutes}
    updated_at: datetime = Field(default_factory=utcnow)


class StudySession(SQLModel, table=True):
    __tablename__ = "study_sessions"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    subject: str = Field(index=True)
    minutes: int
    mode: str = Field(default="pomodoro")
    notes: Optional[str] = None
    # gamification
    xp_earned: int = Field(default=0)
    gold_earned: int = Field(default=0)
    started_at: datetime = Field(default_factory=utcnow)
    created_at: datetime = Field(default_factory=utcnow)
    deleted_at: Optional[datetime] = Field(default=None, index=True)
    date_key: str = Field(index=True)  # YYYY-MM-DD (user local)


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


class Subject(SQLModel, table=True):
    __tablename__ = "subjects"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    name: str = Field(index=True)
    color: Optional[str] = Field(default=None)
    icon: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=utcnow)
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


class SystemWindowMessage(SQLModel, table=True):
    __tablename__ = "system_window_messages"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    role: str = Field(default="system", index=True)
    content: str = Field(sa_column=Column(Text, nullable=False))
    source: str = Field(default="gemini", index=True)
    xp_hint: Optional[int] = Field(default=None)
    mission_done_hint: Optional[bool] = Field(default=None)
    status_hint: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow, index=True)


class DailyQuest(SQLModel, table=True):
    __tablename__ = "daily_quests"
    __table_args__ = (UniqueConstraint("user_id", "date_key", "subject", name="uq_daily_quest"),)

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    date_key: str = Field(index=True)
    subject: str
    target_minutes: int
    progress_minutes: int = 0
    claimed: bool = False
    title: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default=None)
    rank: Optional[str] = Field(default=None, index=True)
    difficulty: Optional[str] = Field(default=None)
    objective: Optional[str] = Field(default=None)
    tags_json: str = Field(default="[]")
    reward_xp: Optional[int] = Field(default=None)
    reward_gold: Optional[int] = Field(default=None)
    source: str = Field(default="fallback", index=True)
    generated_at: datetime = Field(default_factory=utcnow, index=True)
    created_at: datetime = Field(default_factory=utcnow)


class WeeklyQuest(SQLModel, table=True):
    __tablename__ = "weekly_quests"
    __table_args__ = (UniqueConstraint("user_id", "week_key", "subject", name="uq_weekly_quest"),)

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    week_key: str = Field(index=True)  # YYYY-MM-DD (week start, user local)
    subject: str
    target_minutes: int
    progress_minutes: int = 0
    claimed: bool = False
    title: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default=None)
    rank: Optional[str] = Field(default=None, index=True)
    difficulty: Optional[str] = Field(default=None)
    objective: Optional[str] = Field(default=None)
    tags_json: str = Field(default="[]")
    reward_xp: Optional[int] = Field(default=None)
    reward_gold: Optional[int] = Field(default=None)
    source: str = Field(default="fallback", index=True)
    generated_at: datetime = Field(default_factory=utcnow, index=True)
    created_at: datetime = Field(default_factory=utcnow)


class StudyBlock(SQLModel, table=True):
    __tablename__ = "study_blocks"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    day_of_week: int = Field(index=True)  # 0=Mon ... 6=Sun
    start_time: str = Field(default="20:00")  # HH:MM
    duration_min: int = Field(default=30)
    subject: str = Field(default="SQL")
    mode: str = Field(default="pomodoro")
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class Drill(SQLModel, table=True):
    __tablename__ = "drills"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    subject: str = Field(index=True)
    question: str
    answer: str
    tags_json: str = Field(default="[]")  # JSON list[str]
    created_by_user_id: Optional[str] = Field(
        default=None,
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="SET NULL"),
            index=True,
            nullable=True,
        ),
    )
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class DrillReview(SQLModel, table=True):
    __tablename__ = "drill_reviews"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    drill_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("drills.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    next_review_at: datetime = Field(default_factory=utcnow)
    interval_days: int = 1
    ease: float = 2.5
    reps: int = 0
    last_result: Optional[str] = None
    # training stats
    good_count: int = Field(default=0)
    again_count: int = Field(default=0)
    total_time_ms: int = Field(default=0)
    last_time_ms: Optional[int] = Field(default=None)
    last_difficulty: Optional[str] = Field(default=None)
    updated_at: datetime = Field(default_factory=utcnow)


class RefreshToken(SQLModel, table=True):
    """Optional refresh token persistence.

    We don't *require* this for auth to work (JWT cookies still work),
    but when enabled it allows revocation/rotation and a cleanup job.
    """

    __tablename__ = "refresh_tokens"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    token_hash: str = Field(index=True, unique=True)
    expires_at: datetime = Field(index=True)
    revoked_at: Optional[datetime] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utcnow)


class UserAchievement(SQLModel, table=True):
    """Persist unlocked achievements per user.

    Achievements are identified by a stable string key (e.g. "first_session").
    """

    __tablename__ = "user_achievements"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    key: str = Field(index=True)
    unlocked_at: datetime = Field(default_factory=utcnow, index=True)


class UserWebhook(SQLModel, table=True):
    """User-configurable outbound webhooks (integrations).

    Stored as a URL + list of event names (JSON array). Optional secret is encrypted at rest.
    """

    __tablename__ = "user_webhooks"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    url: str = Field(sa_column=Column(String, nullable=False))
    events_json: str = Field(sa_column=Column(Text, nullable=False, default="[]"))
    # Legacy plaintext column kept for backward compatibility/migration.
    secret: Optional[str] = Field(default=None, sa_column=Column(String, nullable=True))
    secret_encrypted: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    secret_key_id: Optional[str] = Field(default=None, sa_column=Column(String(64), nullable=True))
    is_active: bool = Field(default=True, index=True)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class WebhookOutbox(SQLModel, table=True):
    """Durable queue for webhook delivery."""

    __tablename__ = "webhook_outbox"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    webhook_id: Optional[str] = Field(
        default=None,
        sa_column=Column(
            String,
            ForeignKey("user_webhooks.id", ondelete="SET NULL"),
            index=True,
            nullable=True,
        ),
    )
    event: str = Field(index=True)
    payload_json: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    status: str = Field(
        default="pending",
        sa_column=Column(String(32), nullable=False, index=True),
    )
    attempt_count: int = Field(default=0)
    next_attempt_at: datetime = Field(default_factory=utcnow, index=True)
    last_attempt_at: Optional[datetime] = Field(default=None)
    delivered_at: Optional[datetime] = Field(default=None, index=True)
    dead_at: Optional[datetime] = Field(default=None, index=True)
    last_status_code: Optional[int] = Field(default=None)
    last_error: Optional[str] = Field(default=None, sa_column=Column(Text, nullable=True))
    locked_by: Optional[str] = Field(default=None, index=True)
    locked_until: Optional[datetime] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=utcnow, index=True)
    updated_at: datetime = Field(default_factory=utcnow, index=True)


class AuditEvent(SQLModel, table=True):
    """Append-only audit log for security/forensics.

    Typical events: login, refresh, logout, session.create, quest.claim.
    """

    __tablename__ = "audit_events"

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: Optional[str] = Field(
        default=None,
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="SET NULL"),
            index=True,
            nullable=True,
        ),
    )
    event: str = Field(index=True)
    metadata_json: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )
    ip: Optional[str] = Field(default=None, index=True)
    user_agent: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=utcnow, index=True)


class XpLedgerEvent(SQLModel, table=True):
    """Immutable XP/Gold ledger for auditing and replay."""

    __tablename__ = "xp_ledger_events"
    __table_args__ = (
        UniqueConstraint("user_id", "source_type", "source_ref", name="uq_xp_ledger_source"),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    event_type: str = Field(index=True)
    source_type: str = Field(default="generic", index=True)
    source_ref: str = Field(default_factory=lambda: str(uuid4()), index=True)
    xp_delta: int = Field(default=0)
    gold_delta: int = Field(default=0)
    ruleset_version: int = Field(default=1, index=True)
    payload_json: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utcnow, index=True)


class RewardClaim(SQLModel, table=True):
    """Track claim operations and guarantee one claim per mission instance."""

    __tablename__ = "reward_claims"
    __table_args__ = (
        UniqueConstraint("user_id", "mission_cycle", "mission_id", name="uq_reward_claim"),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    mission_cycle: str = Field(index=True)  # daily | weekly
    mission_id: str = Field(index=True)
    reward_xp: int = Field(default=0)
    reward_gold: int = Field(default=0)
    created_at: datetime = Field(default_factory=utcnow, index=True)


class CommandIdempotency(SQLModel, table=True):
    """Persist command outcomes keyed by user + command + idempotency key."""

    __tablename__ = "command_idempotency"
    __table_args__ = (
        UniqueConstraint("user_id", "command_type", "idempotency_key", name="uq_command_idempotency"),
    )

    id: str = Field(default_factory=lambda: str(uuid4()), primary_key=True)
    user_id: str = Field(
        sa_column=Column(
            String,
            ForeignKey("users.id", ondelete="CASCADE"),
            index=True,
            nullable=False,
        )
    )
    command_type: str = Field(index=True)
    idempotency_key: str = Field(index=True)
    response_json: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    status_code: int = Field(default=200)
    created_at: datetime = Field(default_factory=utcnow, index=True)


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
