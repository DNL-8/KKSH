from __future__ import annotations

import argparse
from uuid import uuid4

from app.workers.webhook_outbox_worker import process_once, run_forever


def main() -> None:
    parser = argparse.ArgumentParser(description="Run webhook outbox worker.")
    parser.add_argument("--once", action="store_true", help="Process one batch and exit.")
    parser.add_argument("--worker-id", default=f"worker-{uuid4()}", help="Worker identifier.")
    args = parser.parse_args()

    if args.once:
        stats = process_once(worker_id=args.worker_id)
        print(stats)
        return

    run_forever(worker_id=args.worker_id)


if __name__ == "__main__":
    main()
