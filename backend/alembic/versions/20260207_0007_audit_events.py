"""audit events

Revision ID: 20260207_0007
Revises: 20260207_0006
Create Date: 2026-02-07

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260207_0007"
down_revision = "20260207_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=True),
        sa.Column("event", sa.String(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("ip", sa.String(), nullable=True),
        sa.Column("user_agent", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_audit_events_user_id", "audit_events", ["user_id"], unique=False)
    op.create_index("ix_audit_events_event", "audit_events", ["event"], unique=False)
    op.create_index("ix_audit_events_ip", "audit_events", ["ip"], unique=False)
    op.create_index("ix_audit_events_created_at", "audit_events", ["created_at"], unique=False)

    if dialect != "sqlite":
        op.create_foreign_key(
            "fk_audit_events_user_id",
            "audit_events",
            "users",
            ["user_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect != "sqlite":
        try:
            op.drop_constraint("fk_audit_events_user_id", type_="foreignkey")
        except Exception:
            pass

    op.drop_index("ix_audit_events_created_at", table_name="audit_events")
    op.drop_index("ix_audit_events_ip", table_name="audit_events")
    op.drop_index("ix_audit_events_event", table_name="audit_events")
    op.drop_index("ix_audit_events_user_id", table_name="audit_events")
    op.drop_table("audit_events")
