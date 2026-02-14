from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone

from sqlmodel import select

from app.db import get_session
from app.models import WebhookOutbox
from app.services.webhooks import OUTBOX_STATUS_DEAD, OUTBOX_STATUS_SENT, OUTBOX_STATUS_SHADOW


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def main() -> None:
    parser = argparse.ArgumentParser(description="Cleanup webhook outbox history.")
    parser.add_argument("--sent-days", type=int, default=14)
    parser.add_argument("--shadow-days", type=int, default=7)
    parser.add_argument("--dead-days", type=int, default=30)
    args = parser.parse_args()

    now = _now_utc()
    sent_cutoff = now - timedelta(days=max(1, int(args.sent_days)))
    shadow_cutoff = now - timedelta(days=max(1, int(args.shadow_days)))
    dead_cutoff = now - timedelta(days=max(1, int(args.dead_days)))

    deleted_sent = 0
    deleted_shadow = 0
    deleted_dead = 0

    with get_session() as session:
        sent_rows = session.exec(
            select(WebhookOutbox).where(
                WebhookOutbox.status == OUTBOX_STATUS_SENT,
                WebhookOutbox.delivered_at.is_not(None),
                WebhookOutbox.delivered_at < sent_cutoff,
            )
        ).all()
        for row in sent_rows:
            session.delete(row)
            deleted_sent += 1

        shadow_rows = session.exec(
            select(WebhookOutbox).where(
                WebhookOutbox.status == OUTBOX_STATUS_SHADOW,
                WebhookOutbox.created_at < shadow_cutoff,
            )
        ).all()
        for row in shadow_rows:
            session.delete(row)
            deleted_shadow += 1

        dead_rows = session.exec(
            select(WebhookOutbox).where(
                WebhookOutbox.status == OUTBOX_STATUS_DEAD,
                WebhookOutbox.dead_at.is_not(None),
                WebhookOutbox.dead_at < dead_cutoff,
            )
        ).all()
        for row in dead_rows:
            session.delete(row)
            deleted_dead += 1

        if deleted_sent or deleted_shadow or deleted_dead:
            session.commit()

    print(f"deleted_sent={deleted_sent} deleted_shadow={deleted_shadow} deleted_dead={deleted_dead}")


if __name__ == "__main__":
    main()
