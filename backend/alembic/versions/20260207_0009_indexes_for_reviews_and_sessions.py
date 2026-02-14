"""Add performance indexes for reviews/sessions/quests.

Revision ID: 20260207_0009
Revises: 20260207_0008
Create Date: 2026-02-07

"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "20260207_0009"
down_revision = "20260207_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Reviews: speed up due queue (WHERE user_id = ? AND next_review_at <= now ORDER BY next_review_at)
    op.create_index(
        "ix_drill_reviews_user_next_review_at",
        "drill_reviews",
        ["user_id", "next_review_at"],
        unique=False,
    )

    # Sessions: speed up today/week aggregations and filters.
    op.create_index(
        "ix_study_sessions_user_date_key",
        "study_sessions",
        ["user_id", "date_key"],
        unique=False,
    )

    # Daily quests: common read pattern is (user_id, date_key)
    op.create_index(
        "ix_daily_quests_user_date_key",
        "daily_quests",
        ["user_id", "date_key"],
        unique=False,
    )

    # Weekly quests: common read pattern is (user_id, week_key)
    op.create_index(
        "ix_weekly_quests_user_week_key",
        "weekly_quests",
        ["user_id", "week_key"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_weekly_quests_user_week_key", table_name="weekly_quests")
    op.drop_index("ix_daily_quests_user_date_key", table_name="daily_quests")
    op.drop_index("ix_study_sessions_user_date_key", table_name="study_sessions")
    op.drop_index("ix_drill_reviews_user_next_review_at", table_name="drill_reviews")
