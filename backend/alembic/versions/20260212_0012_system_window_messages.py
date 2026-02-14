"""Add system window message history table.

Revision ID: 20260212_0012
Revises: 20260209_0011
Create Date: 2026-02-12

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260212_0012"
down_revision = "20260209_0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "system_window_messages",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="system"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source", sa.String(), nullable=False, server_default="gemini"),
        sa.Column("xp_hint", sa.Integer(), nullable=True),
        sa.Column("mission_done_hint", sa.Boolean(), nullable=True),
        sa.Column("status_hint", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_system_window_messages_user_id", "system_window_messages", ["user_id"])
    op.create_index("ix_system_window_messages_created_at", "system_window_messages", ["created_at"])
    op.create_index("ix_system_window_messages_role", "system_window_messages", ["role"])
    op.create_index("ix_system_window_messages_source", "system_window_messages", ["source"])


def downgrade() -> None:
    op.drop_index("ix_system_window_messages_source", table_name="system_window_messages")
    op.drop_index("ix_system_window_messages_role", table_name="system_window_messages")
    op.drop_index("ix_system_window_messages_created_at", table_name="system_window_messages")
    op.drop_index("ix_system_window_messages_user_id", table_name="system_window_messages")
    op.drop_table("system_window_messages")
