from __future__ import annotations

import argparse
from datetime import datetime, timezone

from sqlmodel import select

from app.db import get_session
from app.models import WebhookOutbox
from app.services.webhooks import OUTBOX_STATUS_DEAD, OUTBOX_STATUS_RETRY


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def main() -> None:
    parser = argparse.ArgumentParser(description="Requeue dead webhook outbox items.")
    parser.add_argument("--id", default="", help="Requeue a specific outbox id.")
    parser.add_argument(
        "--all-dead",
        action="store_true",
        help="Requeue dead rows in batch (limited by --limit).",
    )
    parser.add_argument("--limit", type=int, default=100, help="Batch size for --all-dead.")
    args = parser.parse_args()

    target_id = str(args.id or "").strip()
    if not target_id and not args.all_dead:
        raise SystemExit("Use --id <outbox_id> or --all-dead.")

    now = _now_utc()
    requeued = 0
    with get_session() as session:
        if target_id:
            row = session.get(WebhookOutbox, target_id)
            if row is None:
                raise SystemExit("Outbox row not found.")
            if row.status == OUTBOX_STATUS_DEAD:
                row.status = OUTBOX_STATUS_RETRY
                row.next_attempt_at = now
                row.dead_at = None
                row.locked_by = None
                row.locked_until = None
                row.updated_at = now
                session.add(row)
                session.commit()
                requeued = 1
        else:
            rows = session.exec(
                select(WebhookOutbox)
                .where(WebhookOutbox.status == OUTBOX_STATUS_DEAD)
                .order_by(WebhookOutbox.dead_at.desc(), WebhookOutbox.updated_at.desc())
                .limit(max(1, int(args.limit)))
            ).all()
            for row in rows:
                row.status = OUTBOX_STATUS_RETRY
                row.next_attempt_at = now
                row.dead_at = None
                row.locked_by = None
                row.locked_until = None
                row.updated_at = now
                session.add(row)
                requeued += 1
            if requeued:
                session.commit()

    print(f"requeued={requeued}")


if __name__ == "__main__":
    main()
