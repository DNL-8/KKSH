"""constraints + views + refresh_tokens

Revision ID: 20260207_0005
Revises: 20260207_0004
Create Date: 2026-02-07

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260207_0005"
down_revision = "20260207_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # --- Refresh tokens (optional persistence) ---
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"], unique=False)
    op.create_index("ix_refresh_tokens_token_hash", "refresh_tokens", ["token_hash"], unique=True)
    op.create_index("ix_refresh_tokens_expires_at", "refresh_tokens", ["expires_at"], unique=False)
    op.create_index("ix_refresh_tokens_revoked_at", "refresh_tokens", ["revoked_at"], unique=False)

    # --- FKs / constraints (Postgres strongly; SQLite limited without batch) ---
    if dialect != "sqlite":
        # user-scoped tables
        op.create_foreign_key(
            "fk_study_plans_user_id",
            "study_plans",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_foreign_key(
            "fk_user_settings_user_id",
            "user_settings",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_foreign_key(
            "fk_user_stats_user_id",
            "user_stats",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_foreign_key(
            "fk_subjects_user_id",
            "subjects",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_foreign_key(
            "fk_study_sessions_user_id",
            "study_sessions",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_foreign_key(
            "fk_daily_quests_user_id",
            "daily_quests",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )

        # drill reviews
        op.create_foreign_key(
            "fk_drill_reviews_user_id",
            "drill_reviews",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_foreign_key(
            "fk_drill_reviews_drill_id",
            "drill_reviews",
            "drills",
            ["drill_id"],
            ["id"],
            ondelete="CASCADE",
        )

        # drills creator
        op.create_foreign_key(
            "fk_drills_created_by_user_id",
            "drills",
            "users",
            ["created_by_user_id"],
            ["id"],
            ondelete="SET NULL",
        )

        # refresh tokens
        op.create_foreign_key(
            "fk_refresh_tokens_user_id",
            "refresh_tokens",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )

    # --- Reporting views (best-effort; used by /reports endpoints) ---
    # Recreate views to avoid drift.
    op.execute("DROP VIEW IF EXISTS v_user_daily_stats")
    op.execute("DROP VIEW IF EXISTS v_user_monthly_stats")

    if dialect == "postgresql":
        op.execute(
            """
            CREATE VIEW v_user_daily_stats AS
            SELECT
              user_id,
              date_key,
              SUM(minutes)::int AS minutes,
              SUM(xp_earned)::int AS xp,
              SUM(gold_earned)::int AS gold,
              COUNT(*)::int AS sessions
            FROM study_sessions
            WHERE deleted_at IS NULL
            GROUP BY user_id, date_key
            """
        )
        op.execute(
            """
            CREATE VIEW v_user_monthly_stats AS
            SELECT
              user_id,
              to_char(to_date(date_key, 'YYYY-MM-DD'), 'YYYY-MM') AS month_key,
              SUM(minutes)::int AS minutes,
              SUM(xp_earned)::int AS xp,
              SUM(gold_earned)::int AS gold,
              COUNT(*)::int AS sessions
            FROM study_sessions
            WHERE deleted_at IS NULL
            GROUP BY user_id, month_key
            """
        )
    else:
        # SQLite fallback (mainly for local/dev)
        op.execute(
            """
            CREATE VIEW v_user_daily_stats AS
            SELECT
              user_id,
              date_key,
              SUM(minutes) AS minutes,
              SUM(xp_earned) AS xp,
              SUM(gold_earned) AS gold,
              COUNT(*) AS sessions
            FROM study_sessions
            WHERE deleted_at IS NULL
            GROUP BY user_id, date_key
            """
        )
        op.execute(
            """
            CREATE VIEW v_user_monthly_stats AS
            SELECT
              user_id,
              SUBSTR(date_key, 1, 7) AS month_key,
              SUM(minutes) AS minutes,
              SUM(xp_earned) AS xp,
              SUM(gold_earned) AS gold,
              COUNT(*) AS sessions
            FROM study_sessions
            WHERE deleted_at IS NULL
            GROUP BY user_id, month_key
            """
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    op.execute("DROP VIEW IF EXISTS v_user_monthly_stats")
    op.execute("DROP VIEW IF EXISTS v_user_daily_stats")

    if dialect != "sqlite":
        for name in [
            "fk_refresh_tokens_user_id",
            "fk_drills_created_by_user_id",
            "fk_drill_reviews_drill_id",
            "fk_drill_reviews_user_id",
            "fk_daily_quests_user_id",
            "fk_study_sessions_user_id",
            "fk_subjects_user_id",
            "fk_user_stats_user_id",
            "fk_user_settings_user_id",
            "fk_study_plans_user_id",
        ]:
            try:
                op.drop_constraint(name, type_="foreignkey")
            except Exception:
                # Some DBs name constraints differently; best-effort downgrade.
                pass

    op.drop_index("ix_refresh_tokens_revoked_at", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_expires_at", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_token_hash", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
