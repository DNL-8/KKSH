"""initial tables

Revision ID: 20260207_0001
Revises: 
Create Date: 2026-02-07

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260207_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "study_plans",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("goals_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_study_plans_user_id", "study_plans", ["user_id"], unique=True)

    op.create_table(
        "study_sessions",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("mode", sa.String(), nullable=False, server_default="pomodoro"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("date_key", sa.String(), nullable=False),
    )
    op.create_index("ix_study_sessions_user_id", "study_sessions", ["user_id"])
    op.create_index("ix_study_sessions_subject", "study_sessions", ["subject"])
    op.create_index("ix_study_sessions_date_key", "study_sessions", ["date_key"])

    op.create_table(
        "daily_quests",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("date_key", sa.String(), nullable=False),
        sa.Column("subject", sa.String(), nullable=False),
        sa.Column("target_minutes", sa.Integer(), nullable=False),
        sa.Column("progress_minutes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("claimed", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_daily_quests_user_id", "daily_quests", ["user_id"])
    op.create_index("ix_daily_quests_date_key", "daily_quests", ["date_key"])

    op.create_table(
        "drill_reviews",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("drill_id", sa.String(), nullable=False),
        sa.Column("next_review_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("interval_days", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("ease", sa.Float(), nullable=False, server_default="2.5"),
        sa.Column("reps", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_result", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_drill_reviews_user_id", "drill_reviews", ["user_id"])
    op.create_index("ix_drill_reviews_drill_id", "drill_reviews", ["drill_id"])


def downgrade() -> None:
    op.drop_index("ix_drill_reviews_drill_id", table_name="drill_reviews")
    op.drop_index("ix_drill_reviews_user_id", table_name="drill_reviews")
    op.drop_table("drill_reviews")

    op.drop_index("ix_daily_quests_date_key", table_name="daily_quests")
    op.drop_index("ix_daily_quests_user_id", table_name="daily_quests")
    op.drop_table("daily_quests")

    op.drop_index("ix_study_sessions_date_key", table_name="study_sessions")
    op.drop_index("ix_study_sessions_subject", table_name="study_sessions")
    op.drop_index("ix_study_sessions_user_id", table_name="study_sessions")
    op.drop_table("study_sessions")

    op.drop_index("ix_study_plans_user_id", table_name="study_plans")
    op.drop_table("study_plans")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
