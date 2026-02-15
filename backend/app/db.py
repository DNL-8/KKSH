from __future__ import annotations

from typing import Any

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings

connect_args = {}
pool_kwargs: dict[str, Any] = {"pool_pre_ping": True}

if settings.database_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}
else:
    # Postgres/MySQL: configurable pool sizing
    pool_kwargs["pool_size"] = int(getattr(settings, "db_pool_size", 5))
    pool_kwargs["max_overflow"] = int(getattr(settings, "db_max_overflow", 10))

engine = create_engine(settings.database_url, connect_args=connect_args, **pool_kwargs)

_SQLITE_COMPAT_COLUMNS: dict[str, dict[str, str]] = {
    "daily_quests": {
        "title": "TEXT",
        "description": "TEXT",
        "rank": "TEXT",
        "difficulty": "TEXT",
        "objective": "TEXT",
        "tags_json": "TEXT DEFAULT '[]'",
        "reward_xp": "INTEGER",
        "reward_gold": "INTEGER",
        "source": "TEXT DEFAULT 'fallback'",
        "generated_at": "DATETIME",
    },
    "weekly_quests": {
        "title": "TEXT",
        "description": "TEXT",
        "rank": "TEXT",
        "difficulty": "TEXT",
        "objective": "TEXT",
        "tags_json": "TEXT DEFAULT '[]'",
        "reward_xp": "INTEGER",
        "reward_gold": "INTEGER",
        "source": "TEXT DEFAULT 'fallback'",
        "generated_at": "DATETIME",
    },
    "user_webhooks": {
        "secret_encrypted": "TEXT",
        "secret_key_id": "TEXT",
    },
    "user_settings": {
        "gemini_api_key": "TEXT",
        "agent_personality": "TEXT DEFAULT 'standard'",
    },
    "user_stats": {
        "rank": "TEXT DEFAULT 'F'",
        "version": "INTEGER DEFAULT 1",
    },
}

_SQLITE_QUEST_INDEXES = (
    "CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_quest ON daily_quests (user_id, date_key, subject)",
    "CREATE INDEX IF NOT EXISTS ix_daily_quests_rank ON daily_quests (rank)",
    "CREATE INDEX IF NOT EXISTS ix_daily_quests_source ON daily_quests (source)",
    "CREATE INDEX IF NOT EXISTS ix_daily_quests_generated_at ON daily_quests (generated_at)",
    "CREATE INDEX IF NOT EXISTS ix_weekly_quests_rank ON weekly_quests (rank)",
    "CREATE INDEX IF NOT EXISTS ix_weekly_quests_source ON weekly_quests (source)",
    "CREATE INDEX IF NOT EXISTS ix_weekly_quests_generated_at ON weekly_quests (generated_at)",
    "CREATE INDEX IF NOT EXISTS ix_user_stats_rank ON user_stats (rank)",
)

# Enable foreign keys on SQLite (important for tests/dev)
if engine.url.get_backend_name() == "sqlite":

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragma(dbapi_connection: Any, connection_record: Any) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def _sqlite_table_columns(connection: Any, table: str) -> set[str]:
    rows = connection.exec_driver_sql(f"PRAGMA table_info('{table}')").all()
    return {str(row[1]) for row in rows}


def _ensure_sqlite_schema_compatibility() -> None:
    if engine.url.get_backend_name() != "sqlite":
        return

    with engine.begin() as connection:
        for table, columns in _SQLITE_COMPAT_COLUMNS.items():
            existing = _sqlite_table_columns(connection, table)
            if not existing:
                continue
            for column, ddl in columns.items():
                if column in existing:
                    continue
                connection.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")

        connection.exec_driver_sql(
            "UPDATE daily_quests SET source = 'fallback' WHERE source IS NULL OR TRIM(source) = ''"
        )
        connection.exec_driver_sql(
            "UPDATE weekly_quests SET source = 'fallback' WHERE source IS NULL OR TRIM(source) = ''"
        )
        connection.exec_driver_sql(
            "UPDATE daily_quests SET tags_json = '[]' WHERE tags_json IS NULL OR TRIM(tags_json) = ''"
        )
        connection.exec_driver_sql(
            "UPDATE weekly_quests SET tags_json = '[]' WHERE tags_json IS NULL OR TRIM(tags_json) = ''"
        )
        connection.exec_driver_sql(
            "UPDATE daily_quests SET generated_at = created_at WHERE generated_at IS NULL"
        )
        connection.exec_driver_sql(
            "UPDATE weekly_quests SET generated_at = created_at WHERE generated_at IS NULL"
        )
        connection.exec_driver_sql(
            "UPDATE user_settings SET agent_personality = 'standard' "
            "WHERE agent_personality IS NULL OR TRIM(agent_personality) = ''"
        )
        connection.exec_driver_sql(
            "UPDATE user_stats SET rank = 'F' WHERE rank IS NULL OR TRIM(rank) = ''"
        )
        connection.exec_driver_sql(
            "UPDATE user_stats SET version = 1 WHERE version IS NULL OR version < 1"
        )

        for statement in _SQLITE_QUEST_INDEXES:
            connection.exec_driver_sql(statement)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)
    _ensure_sqlite_schema_compatibility()


def get_session() -> Session:
    return Session(engine)
