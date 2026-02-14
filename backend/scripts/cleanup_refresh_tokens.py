"""Cleanup job for persisted refresh tokens.

Usage:
  cd backend
  PYTHONPATH=. python scripts/cleanup_refresh_tokens.py

This only deletes rows when PERSIST_REFRESH_TOKENS=true.
"""

from __future__ import annotations

from app.db import get_session
from app.services.tokens import cleanup_expired_refresh_tokens


def main() -> None:
    with get_session() as session:
        deleted = cleanup_expired_refresh_tokens(session)
        print(f"deleted={deleted}")


if __name__ == "__main__":
    main()
