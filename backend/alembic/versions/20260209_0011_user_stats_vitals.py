"""Add persistent vitals fields to user_stats.

Revision ID: 20260209_0011
Revises: 20260209_0010
Create Date: 2026-02-09

"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260209_0011"
down_revision = "20260209_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("user_stats") as batch:
        batch.add_column(sa.Column("hp", sa.Integer(), nullable=False, server_default="100"))
        batch.add_column(sa.Column("max_hp", sa.Integer(), nullable=False, server_default="100"))
        batch.add_column(sa.Column("mana", sa.Integer(), nullable=False, server_default="100"))
        batch.add_column(sa.Column("max_mana", sa.Integer(), nullable=False, server_default="100"))
        batch.add_column(sa.Column("fatigue", sa.Integer(), nullable=False, server_default="20"))
        batch.add_column(sa.Column("max_fatigue", sa.Integer(), nullable=False, server_default="100"))


def downgrade() -> None:
    with op.batch_alter_table("user_stats") as batch:
        batch.drop_column("max_fatigue")
        batch.drop_column("fatigue")
        batch.drop_column("max_mana")
        batch.drop_column("mana")
        batch.drop_column("max_hp")
        batch.drop_column("hp")
