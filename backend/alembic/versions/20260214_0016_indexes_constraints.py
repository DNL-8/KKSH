"""P1: indexes and constraints for performance and data integrity.

Revision ID: 20260214_0016
Revises: 20260214_0015_webhook_outbox
Create Date: 2026-02-14

Adds:
- Partial index on study_sessions WHERE deleted_at IS NULL (#9)
- Composite index (user_id, created_at DESC) on study_sessions (#10)
- Partial index on webhook_outbox WHERE status IN ('pending','retry') (#14)
- Check constraints on user_stats, daily_quests, webhook_outbox (#16)
- Index on refresh_tokens(expires_at) WHERE revoked_at IS NULL
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = "20260214_0016_indexes_constraints"
down_revision = "20260214_0015_webhook_outbox"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # #9 Partial index: study_sessions active rows only
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sessions_active "
        "ON study_sessions (user_id, date_key) "
        "WHERE deleted_at IS NULL"
    )

    # #10 Composite index: cursor pagination on study_sessions
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_sessions_user_created "
        "ON study_sessions (user_id, created_at DESC)"
    )

    # #14 Partial index: webhook_outbox worker query
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_outbox_status_next "
        "ON webhook_outbox (status, next_attempt_at) "
        "WHERE status IN ('pending', 'retry')"
    )

    # Index: refresh_tokens for active token lookup + cleanup
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_refresh_tokens_active "
        "ON refresh_tokens (token_hash, expires_at) "
        "WHERE revoked_at IS NULL"
    )

    # #16 Check constraints
    op.execute(
        "ALTER TABLE user_stats ADD CONSTRAINT ck_user_stats_xp_positive "
        "CHECK (xp >= 0)"
    )
    op.execute(
        "ALTER TABLE user_stats ADD CONSTRAINT ck_user_stats_gold_positive "
        "CHECK (gold >= 0)"
    )
    op.execute(
        "ALTER TABLE user_stats ADD CONSTRAINT ck_user_stats_level_min "
        "CHECK (level >= 1)"
    )
    op.execute(
        "ALTER TABLE daily_quests ADD CONSTRAINT ck_daily_quests_progress "
        "CHECK (progress_minutes >= 0)"
    )
    op.execute(
        "ALTER TABLE daily_quests ADD CONSTRAINT ck_daily_quests_target "
        "CHECK (target_minutes > 0)"
    )
    op.execute(
        "ALTER TABLE webhook_outbox ADD CONSTRAINT ck_outbox_attempts "
        "CHECK (attempt_count >= 0)"
    )


def downgrade() -> None:
    # Drop check constraints
    op.execute("ALTER TABLE webhook_outbox DROP CONSTRAINT IF EXISTS ck_outbox_attempts")
    op.execute("ALTER TABLE daily_quests DROP CONSTRAINT IF EXISTS ck_daily_quests_target")
    op.execute("ALTER TABLE daily_quests DROP CONSTRAINT IF EXISTS ck_daily_quests_progress")
    op.execute("ALTER TABLE user_stats DROP CONSTRAINT IF EXISTS ck_user_stats_level_min")
    op.execute("ALTER TABLE user_stats DROP CONSTRAINT IF EXISTS ck_user_stats_gold_positive")
    op.execute("ALTER TABLE user_stats DROP CONSTRAINT IF EXISTS ck_user_stats_xp_positive")

    # Drop indexes
    op.execute("DROP INDEX IF EXISTS ix_refresh_tokens_active")
    op.execute("DROP INDEX IF EXISTS ix_outbox_status_next")
    op.execute("DROP INDEX IF EXISTS ix_sessions_user_created")
    op.execute("DROP INDEX IF EXISTS ix_sessions_active")
