from __future__ import annotations

import base64
from datetime import datetime


def encode_cursor(dt: datetime, obj_id: str) -> str:
    # dt must be ISO-8601 with timezone
    raw = f"{dt.isoformat()}|{obj_id}".encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")


def decode_cursor(cursor: str) -> tuple[datetime, str]:
    # add padding
    pad = "=" * (-len(cursor) % 4)
    raw = base64.urlsafe_b64decode((cursor + pad).encode("utf-8")).decode("utf-8")
    ts_s, obj_id = raw.split("|", 1)
    # datetime.fromisoformat supports timezone offsets
    return datetime.fromisoformat(ts_s), obj_id
