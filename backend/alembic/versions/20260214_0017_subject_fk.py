"""P2 #19: add subject_id FK column to support gradual migration from string to FK.

Revision ID: 20260214_0017
Revises: 20260214_0016_indexes_constraints

This is phase 3 of the subject FK migration plan:
1. Adds nullable subject_id FK column to sessions, quests, blocks, drills
2. Populates subject_id from existing subject strings where a matching subject exists
3. Adds indexes on the new FK columns

The string `subject` column is NOT dropped in this migration (phase 5).
"""
from alembic import op
import sqlalchemy as sa


revision = "20260214_0017_subject_fk"
down_revision = "20260214_0016_indexes_constraints"
branch_labels = None
depends_on = None

# Tables that have the subject string + need subject_id FK
_TABLES = ["study_sessions", "daily_quests", "weekly_quests", "study_blocks", "drills"]


def upgrade() -> None:
    for table in _TABLES:
        # Add nullable FK column
        op.add_column(table, sa.Column("subject_id", sa.String(), nullable=True))
        op.create_foreign_key(
            f"fk_{table}_subject_id",
            table,
            "subjects",
            ["subject_id"],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_index(f"ix_{table}_subject_id", table, ["subject_id"])

    # Populate subject_id from existing subject strings
    # Match case-insensitively against subjects.name for the same user
    for table in _TABLES:
        op.execute(f"""
            UPDATE {table} t
            SET subject_id = s.id
            FROM subjects s
            WHERE t.user_id = s.user_id
              AND LOWER(t.subject) = LOWER(s.name)
              AND t.subject_id IS NULL
        """)


def downgrade() -> None:
    for table in reversed(_TABLES):
        op.drop_index(f"ix_{table}_subject_id", table_name=table)
        op.drop_constraint(f"fk_{table}_subject_id", table, type_="foreignkey")
        op.drop_column(table, "subject_id")
