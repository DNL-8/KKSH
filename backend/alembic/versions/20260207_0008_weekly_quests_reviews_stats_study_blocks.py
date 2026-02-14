"""weekly quests + review stats + study blocks

Revision ID: 20260207_0008
Revises: 20260207_0007
Create Date: 2026-02-07

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260207_0008"
down_revision = "20260207_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # ---- drill_reviews: add training stats columns ----
    with op.batch_alter_table("drill_reviews") as batch:
        batch.add_column(sa.Column("good_count", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("again_count", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("total_time_ms", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("last_time_ms", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("last_difficulty", sa.String(), nullable=True))

    # ---- weekly_quests ----
    op.create_table(
        "weekly_quests",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("week_key", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("target_minutes", sa.Integer(), nullable=False),
        sa.Column("progress_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("claimed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_weekly_quests_user_id", "weekly_quests", ["user_id"], unique=False)
    op.create_index("ix_weekly_quests_week_key", "weekly_quests", ["week_key"], unique=False)
    op.create_index(
        "uq_weekly_quests_user_week_subject",
        "weekly_quests",
        ["user_id", "week_key", "subject"],
        unique=True,
    )

    if dialect != "sqlite":
        op.create_foreign_key(
            "fk_weekly_quests_user_id",
            "weekly_quests",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )

    # ---- study_blocks ----
    op.create_table(
        "study_blocks",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("day_of_week", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.String(length=5), nullable=False),
        sa.Column("duration_min", sa.Integer(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("mode", sa.String(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_study_blocks_user_id", "study_blocks", ["user_id"], unique=False)
    op.create_index("ix_study_blocks_day_of_week", "study_blocks", ["day_of_week"], unique=False)
    op.create_index("ix_study_blocks_is_active", "study_blocks", ["is_active"], unique=False)

    if dialect != "sqlite":
        op.create_foreign_key(
            "fk_study_blocks_user_id",
            "study_blocks",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect != "sqlite":
        for name in ["fk_study_blocks_user_id", "fk_weekly_quests_user_id"]:
            try:
                op.drop_constraint(name, type_="foreignkey")
            except Exception:
                pass

    op.drop_index("ix_study_blocks_is_active", table_name="study_blocks")
    op.drop_index("ix_study_blocks_day_of_week", table_name="study_blocks")
    op.drop_index("ix_study_blocks_user_id", table_name="study_blocks")
    op.drop_table("study_blocks")

    op.drop_index("uq_weekly_quests_user_week_subject", table_name="weekly_quests")
    op.drop_index("ix_weekly_quests_week_key", table_name="weekly_quests")
    op.drop_index("ix_weekly_quests_user_id", table_name="weekly_quests")
    op.drop_table("weekly_quests")

    with op.batch_alter_table("drill_reviews") as batch:
        batch.drop_column("last_difficulty")
        batch.drop_column("last_time_ms")
        batch.drop_column("total_time_ms")
        batch.drop_column("again_count")
        batch.drop_column("good_count")
