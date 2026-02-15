from __future__ import annotations

import argparse
from dataclasses import dataclass

from sqlmodel import select

from app.core.secrets import (
    decrypt_secret,
    decrypt_webhook_secret,
    encrypt_secret,
    encrypt_webhook_secret,
)
from app.db import get_session
from app.models import UserSettings, UserWebhook


@dataclass
class ReencryptStats:
    settings_scanned: int = 0
    settings_updated: int = 0
    webhooks_scanned: int = 0
    webhooks_updated: int = 0
    webhooks_skipped: int = 0


def reencrypt(*, dry_run: bool) -> ReencryptStats:
    stats = ReencryptStats()
    with get_session() as session:
        settings_rows = session.exec(select(UserSettings)).all()
        for row in settings_rows:
            stats.settings_scanned += 1
            raw = (row.gemini_api_key or "").strip()
            if not raw:
                continue
            plaintext = decrypt_secret(raw) or ""
            if not plaintext:
                continue
            updated = encrypt_secret(plaintext)
            if updated != raw:
                row.gemini_api_key = updated
                session.add(row)
                stats.settings_updated += 1

        webhook_rows = session.exec(select(UserWebhook)).all()
        for row in webhook_rows:
            stats.webhooks_scanned += 1

            plaintext = None
            if row.secret:
                plaintext = row.secret
            elif row.secret_encrypted:
                plaintext = decrypt_webhook_secret(row.secret_encrypted)

            if not plaintext:
                if row.secret_encrypted:
                    stats.webhooks_skipped += 1
                continue

            encrypted, key_id = encrypt_webhook_secret(plaintext)
            changed = (
                encrypted != (row.secret_encrypted or "")
                or (row.secret_key_id or "") != key_id
                or row.secret is not None
            )
            if changed:
                row.secret_encrypted = encrypted
                row.secret_key_id = key_id
                row.secret = None
                session.add(row)
                stats.webhooks_updated += 1

        if dry_run:
            session.rollback()
        else:
            session.commit()

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Re-encrypt user secrets with current WEBHOOK_SECRET_ENC_KEY."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Persist changes. Without this flag the script runs in dry-run mode.",
    )
    args = parser.parse_args()

    stats = reencrypt(dry_run=not args.apply)
    print(
        {
            "dry_run": not args.apply,
            "settings_scanned": stats.settings_scanned,
            "settings_updated": stats.settings_updated,
            "webhooks_scanned": stats.webhooks_scanned,
            "webhooks_updated": stats.webhooks_updated,
            "webhooks_skipped": stats.webhooks_skipped,
        }
    )


if __name__ == "__main__":
    main()
