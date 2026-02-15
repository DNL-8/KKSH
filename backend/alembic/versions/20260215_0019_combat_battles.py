"""Add combat battles table for backend-authoritative turn combat.

Revision ID: 20260215_0019_combat_battles
Revises: 20260215_0018_backend_first_foundation
"""

from alembic import op
import sqlalchemy as sa


revision = "20260215_0019_combat_battles"
down_revision = "20260215_0018_backend_first_foundation"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "combat_battles",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("module_id", sa.String(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="ongoing"),
        sa.Column("turn_state", sa.String(length=32), nullable=False, server_default="PLAYER_IDLE"),
        sa.Column("player_hp", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("player_max_hp", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("enemy_hp", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("enemy_max_hp", sa.Integer(), nullable=False, server_default="100"),
        sa.Column("enemy_rank", sa.String(length=8), nullable=False, server_default="F"),
        sa.Column("current_question_id", sa.String(), nullable=True),
        sa.Column("last_question_id", sa.String(), nullable=True),
        sa.Column("deck_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_combat_battles_user_id", "combat_battles", ["user_id"])
    op.create_index("ix_combat_battles_module_id", "combat_battles", ["module_id"])
    op.create_index("ix_combat_battles_status", "combat_battles", ["status"])
    op.create_index("ix_combat_battles_turn_state", "combat_battles", ["turn_state"])
    op.create_index("ix_combat_battles_enemy_rank", "combat_battles", ["enemy_rank"])
    op.create_index(
        "ix_combat_battles_current_question_id",
        "combat_battles",
        ["current_question_id"],
    )
    op.create_index("ix_combat_battles_last_question_id", "combat_battles", ["last_question_id"])
    op.create_index("ix_combat_battles_created_at", "combat_battles", ["created_at"])
    op.create_index("ix_combat_battles_updated_at", "combat_battles", ["updated_at"])


def downgrade() -> None:
    op.drop_index("ix_combat_battles_updated_at", table_name="combat_battles")
    op.drop_index("ix_combat_battles_created_at", table_name="combat_battles")
    op.drop_index("ix_combat_battles_last_question_id", table_name="combat_battles")
    op.drop_index("ix_combat_battles_current_question_id", table_name="combat_battles")
    op.drop_index("ix_combat_battles_enemy_rank", table_name="combat_battles")
    op.drop_index("ix_combat_battles_turn_state", table_name="combat_battles")
    op.drop_index("ix_combat_battles_status", table_name="combat_battles")
    op.drop_index("ix_combat_battles_module_id", table_name="combat_battles")
    op.drop_index("ix_combat_battles_user_id", table_name="combat_battles")
    op.drop_table("combat_battles")

