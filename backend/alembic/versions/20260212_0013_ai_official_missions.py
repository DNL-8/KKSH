"""Add AI official mission metadata to daily and weekly quests.

Revision ID: 20260212_0013
Revises: 20260212_0012
Create Date: 2026-02-12

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260212_0013"
down_revision = "20260212_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("daily_quests") as batch:
        batch.add_column(sa.Column("title", sa.String(), nullable=True))
        batch.add_column(sa.Column("description", sa.Text(), nullable=True))
        batch.add_column(sa.Column("rank", sa.String(), nullable=True))
        batch.add_column(sa.Column("difficulty", sa.String(), nullable=True))
        batch.add_column(sa.Column("objective", sa.String(), nullable=True))
        batch.add_column(sa.Column("tags_json", sa.Text(), nullable=False, server_default="[]"))
        batch.add_column(sa.Column("reward_xp", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("reward_gold", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("source", sa.String(), nullable=False, server_default="fallback"))
        batch.add_column(
            sa.Column(
                "generated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            )
        )

    op.create_index("ix_daily_quests_rank", "daily_quests", ["rank"], unique=False)
    op.create_index("ix_daily_quests_source", "daily_quests", ["source"], unique=False)
    op.create_index("ix_daily_quests_generated_at", "daily_quests", ["generated_at"], unique=False)
    op.create_index(
        "uq_daily_quest",
        "daily_quests",
        ["user_id", "date_key", "subject"],
        unique=True,
    )

    with op.batch_alter_table("weekly_quests") as batch:
        batch.add_column(sa.Column("title", sa.String(), nullable=True))
        batch.add_column(sa.Column("description", sa.Text(), nullable=True))
        batch.add_column(sa.Column("rank", sa.String(), nullable=True))
        batch.add_column(sa.Column("difficulty", sa.String(), nullable=True))
        batch.add_column(sa.Column("objective", sa.String(), nullable=True))
        batch.add_column(sa.Column("tags_json", sa.Text(), nullable=False, server_default="[]"))
        batch.add_column(sa.Column("reward_xp", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("reward_gold", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("source", sa.String(), nullable=False, server_default="fallback"))
        batch.add_column(
            sa.Column(
                "generated_at",
                sa.DateTime(timezone=True),
                nullable=False,
                server_default=sa.text("CURRENT_TIMESTAMP"),
            )
        )

    op.create_index("ix_weekly_quests_rank", "weekly_quests", ["rank"], unique=False)
    op.create_index("ix_weekly_quests_source", "weekly_quests", ["source"], unique=False)
    op.create_index("ix_weekly_quests_generated_at", "weekly_quests", ["generated_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_weekly_quests_generated_at", table_name="weekly_quests")
    op.drop_index("ix_weekly_quests_source", table_name="weekly_quests")
    op.drop_index("ix_weekly_quests_rank", table_name="weekly_quests")

    with op.batch_alter_table("weekly_quests") as batch:
        batch.drop_column("generated_at")
        batch.drop_column("source")
        batch.drop_column("reward_gold")
        batch.drop_column("reward_xp")
        batch.drop_column("tags_json")
        batch.drop_column("objective")
        batch.drop_column("difficulty")
        batch.drop_column("rank")
        batch.drop_column("description")
        batch.drop_column("title")

    op.drop_index("uq_daily_quest", table_name="daily_quests")
    op.drop_index("ix_daily_quests_generated_at", table_name="daily_quests")
    op.drop_index("ix_daily_quests_source", table_name="daily_quests")
    op.drop_index("ix_daily_quests_rank", table_name="daily_quests")

    with op.batch_alter_table("daily_quests") as batch:
        batch.drop_column("generated_at")
        batch.drop_column("source")
        batch.drop_column("reward_gold")
        batch.drop_column("reward_xp")
        batch.drop_column("tags_json")
        batch.drop_column("objective")
        batch.drop_column("difficulty")
        batch.drop_column("rank")
        batch.drop_column("description")
        batch.drop_column("title")
