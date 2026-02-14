"""Add encrypted webhook secret columns.

Revision ID: 20260213_0014
Revises: 20260212_0013
Create Date: 2026-02-13
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260213_0014"
down_revision = "20260212_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("user_webhooks") as batch:
        batch.add_column(sa.Column("secret_encrypted", sa.Text(), nullable=True))
        batch.add_column(sa.Column("secret_key_id", sa.String(length=64), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("user_webhooks") as batch:
        batch.drop_column("secret_key_id")
        batch.drop_column("secret_encrypted")
