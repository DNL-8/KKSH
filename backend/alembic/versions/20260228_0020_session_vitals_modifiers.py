"""Persist session vitals deltas and reward multipliers.

Revision ID: 20260228_0020
Revises: 20260215_0019_combat_battles
Create Date: 2026-02-28
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260228_0020"
down_revision = "20260215_0019_combat_battles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("study_sessions") as batch:
        batch.add_column(sa.Column("hp_delta", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("mana_delta", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("fatigue_delta", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(
            sa.Column("reward_multiplier_bps", sa.Integer(), nullable=False, server_default="10000")
        )


def downgrade() -> None:
    with op.batch_alter_table("study_sessions") as batch:
        batch.drop_column("reward_multiplier_bps")
        batch.drop_column("fatigue_delta")
        batch.drop_column("mana_delta")
        batch.drop_column("hp_delta")
