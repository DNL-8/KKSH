"""Add webhook_outbox durable queue table.

Revision ID: 20260214_0015
Revises: 20260213_0014
Create Date: 2026-02-14
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260214_0015"
down_revision = "20260213_0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "webhook_outbox",
        sa.Column("id", sa.String(), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "webhook_id",
            sa.String(),
            sa.ForeignKey("user_webhooks.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("event", sa.String(), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("dead_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_status_code", sa.Integer(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("locked_by", sa.String(), nullable=True),
        sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_index("ix_webhook_outbox_user_id", "webhook_outbox", ["user_id"])
    op.create_index("ix_webhook_outbox_webhook_id", "webhook_outbox", ["webhook_id"])
    op.create_index("ix_webhook_outbox_event", "webhook_outbox", ["event"])
    op.create_index("ix_webhook_outbox_status", "webhook_outbox", ["status"])
    op.create_index("ix_webhook_outbox_next_attempt_at", "webhook_outbox", ["next_attempt_at"])
    op.create_index("ix_webhook_outbox_delivered_at", "webhook_outbox", ["delivered_at"])
    op.create_index("ix_webhook_outbox_dead_at", "webhook_outbox", ["dead_at"])
    op.create_index("ix_webhook_outbox_locked_by", "webhook_outbox", ["locked_by"])
    op.create_index("ix_webhook_outbox_locked_until", "webhook_outbox", ["locked_until"])
    op.create_index("ix_webhook_outbox_created_at", "webhook_outbox", ["created_at"])
    op.create_index("ix_webhook_outbox_updated_at", "webhook_outbox", ["updated_at"])
    op.create_index(
        "ix_webhook_outbox_status_next_attempt_at",
        "webhook_outbox",
        ["status", "next_attempt_at"],
    )
    op.create_index(
        "ix_webhook_outbox_status_locked_until",
        "webhook_outbox",
        ["status", "locked_until"],
    )


def downgrade() -> None:
    op.drop_index("ix_webhook_outbox_status_locked_until", table_name="webhook_outbox")
    op.drop_index("ix_webhook_outbox_status_next_attempt_at", table_name="webhook_outbox")
    op.drop_index("ix_webhook_outbox_updated_at", table_name="webhook_outbox")
    op.drop_index("ix_webhook_outbox_created_at", table_name="webhook_outbox")
    op.drop_index("ix_webhook_outbox_locked_until", table_name="webhook_outbox")
    op.drop_index("ix_webhook_outbox_locked_by", table_name="webhook_outbox")
    op.drop_index("ix_webhook_outbox_dead_at", table_name="webhook_outbox")
    op.drop_index("ix_webhook_outbox_delivered_at", table_name="webhook_outbox")
    op.drop_index("ix_webhook_outbox_next_attempt_at", table_name="webhook_outbox")
    op.drop_index("ix_webhook_outbox_status", table_name="webhook_outbox")
    op.drop_index("ix_webhook_outbox_event", table_name="webhook_outbox")
    op.drop_index("ix_webhook_outbox_webhook_id", table_name="webhook_outbox")
    op.drop_index("ix_webhook_outbox_user_id", table_name="webhook_outbox")
    op.drop_table("webhook_outbox")
