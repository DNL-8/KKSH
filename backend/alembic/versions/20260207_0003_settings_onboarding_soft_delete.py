"""user settings + onboarding + soft delete

Revision ID: 20260207_0003
Revises: 20260207_0002
Create Date: 2026-02-07

"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "20260207_0003"
down_revision = "20260207_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users.onboarding_done
    op.add_column(
        "users",
        sa.Column("onboarding_done", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )

    # study_sessions.deleted_at
    op.add_column(
        "study_sessions",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_study_sessions_deleted_at", "study_sessions", ["deleted_at"], unique=False)

    # user_settings
    op.create_table(
        "user_settings",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("daily_target_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("pomodoro_work_min", sa.Integer(), nullable=False, server_default="25"),
        sa.Column("pomodoro_break_min", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("timezone", sa.String(), nullable=False, server_default="America/Sao_Paulo"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_user_settings_user_id", "user_settings", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_user_settings_user_id", table_name="user_settings")
    op.drop_table("user_settings")

    op.drop_index("ix_study_sessions_deleted_at", table_name="study_sessions")
    op.drop_column("study_sessions", "deleted_at")

    op.drop_column("users", "onboarding_done")
