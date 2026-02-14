"""Add user inventory table.

Revision ID: 20260209_0010
Revises: 20260207_0009
Create Date: 2026-02-09

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260209_0010"
down_revision = "20260207_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    op.create_table(
        "user_inventory",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("item_id", sa.String(), nullable=False),
        sa.Column("qty", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_user_inventory_user_id", "user_inventory", ["user_id"], unique=False)
    op.create_index("ix_user_inventory_item_id", "user_inventory", ["item_id"], unique=False)
    op.create_index(
        "uq_user_inventory_user_item",
        "user_inventory",
        ["user_id", "item_id"],
        unique=True,
    )

    if dialect != "sqlite":
        op.create_foreign_key(
            "fk_user_inventory_user_id",
            "user_inventory",
            "users",
            ["user_id"],
            ["id"],
            ondelete="CASCADE",
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect != "sqlite":
        try:
            op.drop_constraint("fk_user_inventory_user_id", "user_inventory", type_="foreignkey")
        except Exception:
            pass

    op.drop_index("uq_user_inventory_user_item", table_name="user_inventory")
    op.drop_index("ix_user_inventory_item_id", table_name="user_inventory")
    op.drop_index("ix_user_inventory_user_id", table_name="user_inventory")
    op.drop_table("user_inventory")
