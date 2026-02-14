"""subjects + progression + gamification

Revision ID: 20260207_0004
Revises: 20260207_0003
Create Date: 2026-02-07

"""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260207_0004"
down_revision = "20260207_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- study_sessions: gamification ---
    op.add_column(
        "study_sessions",
        sa.Column("xp_earned", sa.Integer(), nullable=False, server_default="0"),
    )
    op.add_column(
        "study_sessions",
        sa.Column("gold_earned", sa.Integer(), nullable=False, server_default="0"),
    )

    # --- user_settings: more knobs ---
    op.add_column(
        "user_settings",
        sa.Column("language", sa.String(), nullable=False, server_default="pt-BR"),
    )
    op.add_column(
        "user_settings",
        sa.Column("reminder_enabled", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "user_settings",
        sa.Column("reminder_time", sa.String(), nullable=False, server_default="20:00"),
    )
    op.add_column(
        "user_settings",
        sa.Column("reminder_every_min", sa.Integer(), nullable=False, server_default="5"),
    )
    op.add_column(
        "user_settings",
        sa.Column("xp_per_minute", sa.Integer(), nullable=False, server_default="5"),
    )
    op.add_column(
        "user_settings",
        sa.Column("gold_per_minute", sa.Integer(), nullable=False, server_default="1"),
    )

    # --- subjects table ---
    op.create_table(
        "subjects",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("icon", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_subjects_user_id", "subjects", ["user_id"], unique=False)
    op.create_index("ix_subjects_name", "subjects", ["name"], unique=False)
    op.create_index("ix_subjects_is_active", "subjects", ["is_active"], unique=False)

    # --- user_stats table ---
    op.create_table(
        "user_stats",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("level", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("max_xp", sa.Integer(), nullable=False, server_default="1000"),
        sa.Column("gold", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_user_stats_user_id", "user_stats", ["user_id"], unique=True)

    # --- Backfill (best-effort, keeps existing sessions useful) ---
    bind = op.get_bind()
    now = datetime.now(timezone.utc)

    # Give existing sessions default rewards based on the default multipliers.
    # We only fill rows that still have the default 0/0.
    bind.execute(
        sa.text(
            """
            UPDATE study_sessions
            SET xp_earned = minutes * 5,
                gold_earned = minutes * 1
            WHERE COALESCE(xp_earned, 0) = 0 AND COALESCE(gold_earned, 0) = 0
            """
        )
    )

    # Aggregate to user_stats (ignore soft-deleted sessions).
    rows = bind.execute(
        sa.text(
            """
            SELECT user_id,
                   COALESCE(SUM(xp_earned), 0) AS xp,
                   COALESCE(SUM(gold_earned), 0) AS gold
            FROM study_sessions
            WHERE deleted_at IS NULL
            GROUP BY user_id
            """
        )
    ).fetchall()

    for user_id, xp, gold in rows:
        bind.execute(
            sa.text(
                """
                INSERT INTO user_stats (id, user_id, level, xp, max_xp, gold, updated_at)
                VALUES (:id, :user_id, :level, :xp, :max_xp, :gold, :updated_at)
                """
            ),
            {
                "id": str(uuid4()),
                "user_id": user_id,
                "level": 1,
                "xp": int(xp),
                "max_xp": 1000,
                "gold": int(gold),
                "updated_at": now,
            },
        )


def downgrade() -> None:
    op.drop_index("ix_user_stats_user_id", table_name="user_stats")
    op.drop_table("user_stats")

    op.drop_index("ix_subjects_is_active", table_name="subjects")
    op.drop_index("ix_subjects_name", table_name="subjects")
    op.drop_index("ix_subjects_user_id", table_name="subjects")
    op.drop_table("subjects")

    op.drop_column("user_settings", "gold_per_minute")
    op.drop_column("user_settings", "xp_per_minute")
    op.drop_column("user_settings", "reminder_every_min")
    op.drop_column("user_settings", "reminder_time")
    op.drop_column("user_settings", "reminder_enabled")
    op.drop_column("user_settings", "language")

    op.drop_column("study_sessions", "gold_earned")
    op.drop_column("study_sessions", "xp_earned")
