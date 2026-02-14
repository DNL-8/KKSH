"""Fail if DB schema differs from SQLModel metadata.

This is useful to prevent *migration drift*.

Recommended usage (SQLite):
  cd backend
  export DATABASE_URL=sqlite:///./drift.db
  export AUTO_CREATE_DB=false
  alembic upgrade head
  PYTHONPATH=. python scripts/check_schema_drift.py
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

from sqlmodel import SQLModel, create_engine

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.append(str(BASE_DIR))


_SQLITE_IGNORABLE_OPS = {
    # SQLite reflection/autogenerate often emits noisy FK/index/constraint/type diffs.
    # We keep drift gate focused on structural changes (tables/columns).
    "add_fk",
    "remove_fk",
    "add_index",
    "remove_index",
    "add_constraint",
    "remove_constraint",
    "modify_type",
}


def _diff_op(diff: Any) -> str | None:
    if isinstance(diff, tuple) and diff and isinstance(diff[0], str):
        return diff[0]
    if isinstance(diff, list) and len(diff) == 1:
        inner = diff[0]
        if isinstance(inner, tuple) and inner and isinstance(inner[0], str):
            return inner[0]
    return None


def _filter_diffs(diffs: list[Any], *, sqlite: bool) -> tuple[list[Any], list[Any]]:
    if not sqlite:
        return diffs, []

    kept: list[Any] = []
    ignored: list[Any] = []
    for diff in diffs:
        op = _diff_op(diff)
        if op in _SQLITE_IGNORABLE_OPS:
            ignored.append(diff)
        else:
            kept.append(diff)
    return kept, ignored


def _load_settings():
    # Lazy-import app modules after path bootstrap above.
    from app import models  # noqa: F401  # ensure SQLModel metadata is populated
    from app.core.config import settings

    return settings


def main() -> None:
    settings = _load_settings()
    # Use settings.database_url (env-configured)
    engine = create_engine(settings.database_url)
    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        raw_diffs: list[Any] = compare_metadata(ctx, SQLModel.metadata)

    filtered_diffs, ignored_diffs = _filter_diffs(
        raw_diffs,
        sqlite=engine.dialect.name == "sqlite",
    )

    if ignored_diffs:
        print(f"info: ignored {len(ignored_diffs)} sqlite-noise diff(s)")

    if filtered_diffs:
        print("SCHEMA DRIFT DETECTED:")
        for d in filtered_diffs:
            print("-", d)
        sys.exit(1)

    print("ok: no drift")


if __name__ == "__main__":
    main()
