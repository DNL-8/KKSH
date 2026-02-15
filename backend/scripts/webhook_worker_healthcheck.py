from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from app.core.config import settings


def _fail(message: str) -> int:
    print(message)
    return 1


def main() -> int:
    path = Path(settings.webhook_worker_heartbeat_file)
    if not path.exists():
        return _fail(f"heartbeat_missing:{path}")

    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return _fail(f"heartbeat_invalid_json:{exc.__class__.__name__}")

    ts_raw = str(payload.get("ts", "")).strip()
    if not ts_raw:
        return _fail("heartbeat_missing_ts")

    try:
        ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
    except Exception as exc:
        return _fail(f"heartbeat_invalid_ts:{exc.__class__.__name__}")

    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)

    age_sec = (datetime.now(timezone.utc) - ts.astimezone(timezone.utc)).total_seconds()
    max_age = max(10, int(settings.webhook_worker_heartbeat_max_age_sec))
    if age_sec > max_age:
        return _fail(f"heartbeat_stale:age_sec={int(age_sec)} max_age_sec={max_age}")

    print("ok")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
