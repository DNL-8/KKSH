from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from sqlmodel import SQLModel, create_engine

from alembic import context

# Ensure we can import `app`
BASE_DIR = Path(__file__).resolve().parents[1]
sys.path.append(str(BASE_DIR))

from app import models  # noqa: F401,E402  (import models so metadata is populated)
from app.core.config import settings  # noqa: E402

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def get_url() -> str:
    # Alembic prefers a URL string
    return settings.database_url


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    url = get_url()
    connect_args = {}
    if url.startswith("sqlite"):
        connect_args = {"check_same_thread": False}

    connectable = create_engine(url, pool_pre_ping=True, connect_args=connect_args)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
