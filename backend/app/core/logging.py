from __future__ import annotations

import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

from app.core.config import settings
from app.core.request_context import get_request_id

_BASE_LOG_RECORD_FIELDS = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__.keys())


def _to_json_value(value: Any) -> Any:
    try:
        json.dumps(value)
        return value
    except Exception:
        return str(value)


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
        # Attach extra fields added via logger(..., extra={...}) in a structured way.
        for key, value in record.__dict__.items():
            if key in _BASE_LOG_RECORD_FIELDS:
                continue
            if key.startswith("_"):
                continue
            payload[key] = _to_json_value(value)
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
