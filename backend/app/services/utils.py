from __future__ import annotations

import json
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.core.deps import DEFAULT_GOALS


def now_local() -> datetime:
    return datetime.now(tz=ZoneInfo(settings.tz))


def date_key(d: datetime | None = None) -> str:
    d = d or now_local()
    return d.strftime("%Y-%m-%d")


def week_key(d: datetime | None = None) -> str:
    """Return the week-start date key (Monday) in the user's local tz."""
    d = d or now_local()
    monday = d.date() - timedelta(days=d.weekday())
    return monday.strftime("%Y-%m-%d")


def parse_goals(goals_json: str) -> dict[str, int]:
    try:
        raw = json.loads(goals_json or "{}")
        if not isinstance(raw, dict):
            raise ValueError("goals_json not dict")
        # merge with defaults to keep stable subjects
        merged = {**DEFAULT_GOALS}
        for k, v in raw.items():
            try:
                merged[str(k)] = int(v)
            except Exception:
                continue
        return merged
    except Exception:
        return {**DEFAULT_GOALS}


def dump_goals(goals: dict[str, int]) -> str:
    merged = {**DEFAULT_GOALS}
    for k, v in goals.items():
        try:
            merged[str(k)] = int(v)
        except Exception:
            continue
    return json.dumps(merged, ensure_ascii=False)
