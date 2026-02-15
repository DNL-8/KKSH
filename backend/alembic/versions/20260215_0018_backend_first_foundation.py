"""Backend-first foundation: progression rank/version + ledger/idempotency tables.

Revision ID: 20260215_0018_backend_first_foundation
Revises: 20260214_0017_subject_fk
"""

from alembic import op
import sqlalchemy as sa


revision = "20260215_0018_backend_first_foundation"
down_revision = "20260214_0017_subject_fk"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # user_stats additions for backend-authoritative progression snapshots
    op.add_column(
        "user_stats",
        sa.Column("rank", sa.String(length=8), nullable=False, server_default="F"),
    )
    op.add_column(
        "user_stats",
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
    )
    op.create_index("ix_user_stats_rank", "user_stats", ["rank"])

    op.execute(
        """
        UPDATE user_stats
        SET rank = CASE
            WHEN level BETWEEN 1 AND 4 THEN 'F'
            WHEN level BETWEEN 5 AND 9 THEN 'E'
            WHEN level BETWEEN 10 AND 19 THEN 'D'
            WHEN level BETWEEN 20 AND 34 THEN 'C'
            WHEN level BETWEEN 35 AND 49 THEN 'B'
            WHEN level BETWEEN 50 AND 74 THEN 'A'
            ELSE 'S'
        END
        """
    )

    op.create_table(
        "xp_ledger_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("source_type", sa.String(), nullable=False, server_default="generic"),
        sa.Column("source_ref", sa.String(), nullable=False),
        sa.Column("xp_delta", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("gold_delta", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ruleset_version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "source_type", "source_ref", name="uq_xp_ledger_source"),
    )
    op.create_index("ix_xp_ledger_events_user_id", "xp_ledger_events", ["user_id"])
    op.create_index("ix_xp_ledger_events_event_type", "xp_ledger_events", ["event_type"])
    op.create_index("ix_xp_ledger_events_source_type", "xp_ledger_events", ["source_type"])
    op.create_index("ix_xp_ledger_events_source_ref", "xp_ledger_events", ["source_ref"])
    op.create_index("ix_xp_ledger_events_ruleset_version", "xp_ledger_events", ["ruleset_version"])
    op.create_index("ix_xp_ledger_events_created_at", "xp_ledger_events", ["created_at"])

    op.create_table(
        "reward_claims",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("mission_cycle", sa.String(), nullable=False),
        sa.Column("mission_id", sa.String(), nullable=False),
        sa.Column("reward_xp", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("reward_gold", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "mission_cycle", "mission_id", name="uq_reward_claim"),
    )
    op.create_index("ix_reward_claims_user_id", "reward_claims", ["user_id"])
    op.create_index("ix_reward_claims_mission_cycle", "reward_claims", ["mission_cycle"])
    op.create_index("ix_reward_claims_mission_id", "reward_claims", ["mission_id"])
    op.create_index("ix_reward_claims_created_at", "reward_claims", ["created_at"])

    op.create_table(
        "command_idempotency",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("command_type", sa.String(), nullable=False),
        sa.Column("idempotency_key", sa.String(), nullable=False),
        sa.Column("response_json", sa.JSON(), nullable=False),
        sa.Column("status_code", sa.Integer(), nullable=False, server_default="200"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "command_type",
            "idempotency_key",
            name="uq_command_idempotency",
        ),
    )
    op.create_index("ix_command_idempotency_user_id", "command_idempotency", ["user_id"])
    op.create_index(
        "ix_command_idempotency_command_type",
        "command_idempotency",
        ["command_type"],
    )
    op.create_index(
        "ix_command_idempotency_idempotency_key",
        "command_idempotency",
        ["idempotency_key"],
    )
    op.create_index("ix_command_idempotency_created_at", "command_idempotency", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_command_idempotency_created_at", table_name="command_idempotency")
    op.drop_index("ix_command_idempotency_idempotency_key", table_name="command_idempotency")
    op.drop_index("ix_command_idempotency_command_type", table_name="command_idempotency")
    op.drop_index("ix_command_idempotency_user_id", table_name="command_idempotency")
    op.drop_table("command_idempotency")

    op.drop_index("ix_reward_claims_created_at", table_name="reward_claims")
    op.drop_index("ix_reward_claims_mission_id", table_name="reward_claims")
    op.drop_index("ix_reward_claims_mission_cycle", table_name="reward_claims")
    op.drop_index("ix_reward_claims_user_id", table_name="reward_claims")
    op.drop_table("reward_claims")

    op.drop_index("ix_xp_ledger_events_created_at", table_name="xp_ledger_events")
    op.drop_index("ix_xp_ledger_events_ruleset_version", table_name="xp_ledger_events")
    op.drop_index("ix_xp_ledger_events_source_ref", table_name="xp_ledger_events")
    op.drop_index("ix_xp_ledger_events_source_type", table_name="xp_ledger_events")
    op.drop_index("ix_xp_ledger_events_event_type", table_name="xp_ledger_events")
    op.drop_index("ix_xp_ledger_events_user_id", table_name="xp_ledger_events")
    op.drop_table("xp_ledger_events")

    op.drop_index("ix_user_stats_rank", table_name="user_stats")
    op.drop_column("user_stats", "version")
    op.drop_column("user_stats", "rank")

