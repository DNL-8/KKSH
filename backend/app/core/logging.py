from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.core.request_context import get_request_id


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        rid = get_request_id()
        if rid:
            payload["request_id"] = rid
        # Attach extra fields if present
        for key in ("path", "method", "status_code", "duration_ms", "user_id", "ip"):
            if hasattr(record, key):
                payload[key] = getattr(record, key)
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)


def setup_logging() -> None:
    level = getattr(logging, str(settings.log_level).upper(), logging.INFO)
    root = logging.getLogger()
    root.setLevel(level)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JsonFormatter())

    # Clear existing handlers (uvicorn may add its own)
    root.handlers = [handler]

    # Make uvicorn loggers propagate to root
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        logging.getLogger(name).handlers = []
        logging.getLogger(name).propagate = True
        logging.getLogger(name).setLevel(level)
