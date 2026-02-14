"""achievements + webhooks

Revision ID: 20260207_0006
Revises: 20260207_0005
Create Date: 2026-02-07

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260207_0006"
down_revision = "20260207_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    # --- Achievements ---
    op.create_table(
        "user_achievements",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("unlocked_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "key", name="uq_user_achievements_user_key"),
    )
    op.create_index("ix_user_achievements_user_id", "user_achievements", ["user_id"], unique=False)
    op.create_index("ix_user_achievements_key", "user_achievements", ["key"], unique=False)
    op.create_index("ix_user_achievements_unlocked_at", "user_achievements", ["unlocked_at"], unique=False)

    # --- Webhooks ---
    op.create_table(
        "user_webhooks",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("url", sa.String(), nullable=False),
        sa.Column("events_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("secret", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_user_webhooks_user_id", "user_webhooks", ["user_id"], unique=False)
    op.create_index("ix_user_webhooks_is_active", "user_webhooks", ["is_active"], unique=False)

    if dialect != "sqlite":
        op.create_foreign_key(
            "fk_user_achievements_user_id",
            "user_achievements",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )
        op.create_foreign_key(
            "fk_user_webhooks_user_id",
            "user_webhooks",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect != "sqlite":
        for name in [
            "fk_user_webhooks_user_id",
            "fk_user_achievements_user_id",
        ]:
            try:
                op.drop_constraint(name, type_="foreignkey")
            except Exception:
                pass

    op.drop_index("ix_user_webhooks_is_active", table_name="user_webhooks")
    op.drop_index("ix_user_webhooks_user_id", table_name="user_webhooks")
    op.drop_table("user_webhooks")

    op.drop_index("ix_user_achievements_unlocked_at", table_name="user_achievements")
    op.drop_index("ix_user_achievements_key", table_name="user_achievements")
    op.drop_index("ix_user_achievements_user_id", table_name="user_achievements")
    op.drop_table("user_achievements")
