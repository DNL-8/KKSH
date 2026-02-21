"""Shared Gemini SDK client used by both AI endpoints and mission generator."""

from __future__ import annotations

import json
import re
import time
from typing import Any, Literal

from starlette.concurrency import run_in_threadpool

from app.core.config import settings
from app.core.metrics import record_ai_error, record_ai_request

_API_KEY_PLACEHOLDERS = {"", "SUA_CHAVE_AQUI", "YOUR_API_KEY_HERE"}
_RETRY_AFTER_PATTERN = re.compile(
    r"(?:retry(?:-|\s)?after|retry(?:_|\s)?in)\D*(\d+)", re.IGNORECASE
)
_SECONDS_PATTERN = re.compile(r"seconds?\D*(\d+)", re.IGNORECASE)


# ---------------------------------------------------------------------------
# API key resolution
# ---------------------------------------------------------------------------


def get_api_key(*, user_gemini_key: str | None = None) -> str:
    """Return the best available Gemini API key.

    Priority: user-supplied key > system env key.
    Returns empty string when no valid key is found.
    """
    if user_gemini_key:
        raw = user_gemini_key.strip()
        if raw and raw.upper() not in _API_KEY_PLACEHOLDERS:
            return raw
    raw = settings.gemini_api_key.strip()
    if raw.upper() in _API_KEY_PLACEHOLDERS:
        return ""
    return raw


# ---------------------------------------------------------------------------
# SDK response extraction
# ---------------------------------------------------------------------------


def extract_first_text(payload: dict[str, Any]) -> str | None:
    """Extract text from a raw Gemini REST-style response dict."""
    candidates = payload.get("candidates")
    if not isinstance(candidates, list) or not candidates:
        return None
    first = candidates[0]
    if not isinstance(first, dict):
        return None
    content = first.get("content")
    if not isinstance(content, dict):
        return None
    parts = content.get("parts")
    if not isinstance(parts, list) or not parts:
        return None
    part = parts[0]
    if not isinstance(part, dict):
        return None
    text = part.get("text")
    if not isinstance(text, str):
        return None
    cleaned = text.strip()
    return cleaned or None


def extract_sdk_text(response: Any) -> str | None:
    """Extract text from a google-genai SDK response object."""
    text: Any = None
    try:
        text = getattr(response, "text", None)
    except Exception:
        text = None

    if isinstance(text, str):
        cleaned = text.strip()
        if cleaned:
            return cleaned

    to_dict = getattr(response, "to_dict", None)
    if callable(to_dict):
        try:
            payload = to_dict()
        except Exception:
            payload = None
        if isinstance(payload, dict):
            return extract_first_text(payload)
    return None


# ---------------------------------------------------------------------------
# JSON helpers
# ---------------------------------------------------------------------------


def parse_json_object(raw: str) -> dict[str, Any] | None:
    """Parse a JSON object from a raw string (stripping markdown fences)."""
    cleaned = raw.replace("```json", "").replace("```", "").strip()
    if not cleaned:
        return None
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def extract_json_block(raw: str) -> str:
    """Strip optional markdown fences from a JSON block."""
    return raw.replace("```json", "").replace("```", "").strip()


# ---------------------------------------------------------------------------
# Model chain resolution
# ---------------------------------------------------------------------------


def resolve_model_chain() -> list[str]:
    """Return the ordered list of models to try."""
    raw = settings.gemini_model_chain.strip()
    if not raw:
        return [settings.gemini_model]
    parsed = [part.strip() for part in raw.split(",") if part.strip()]
    if not parsed:
        return [settings.gemini_model]
    unique: list[str] = []
    seen: set[str] = set()
    for model in parsed:
        if model in seen:
            continue
        seen.add(model)
        unique.append(model)
    return unique or [settings.gemini_model]


# ---------------------------------------------------------------------------
# Provider error classification
# ---------------------------------------------------------------------------


def _coerce_positive_int(value: Any) -> int | None:
    try:
        parsed = int(str(value).strip())
    except Exception:
        return None
    if parsed <= 0:
        return None
    return parsed


def _extract_provider_status(exc: Exception, text: str) -> int | None:
    for attr in ("status_code", "http_status", "status", "code"):
        raw = getattr(exc, attr, None)
        parsed = _coerce_positive_int(raw)
        if parsed is not None and 100 <= parsed <= 599:
            return parsed

    response = getattr(exc, "response", None)
    if response is not None:
        for attr in ("status_code", "status"):
            raw = getattr(response, attr, None)
            parsed = _coerce_positive_int(raw)
            if parsed is not None and 100 <= parsed <= 599:
                return parsed

    match = re.search(r"\b([45]\d{2})\b", text)
    if match:
        parsed = _coerce_positive_int(match.group(1))
        if parsed is not None and 100 <= parsed <= 599:
            return parsed
    return None


def _extract_retry_after_sec(exc: Exception, text: str) -> int | None:
    for attr in ("retry_after", "retry_after_sec", "retry_after_seconds"):
        parsed = _coerce_positive_int(getattr(exc, attr, None))
        if parsed is not None:
            return parsed

    response = getattr(exc, "response", None)
    if response is not None:
        headers = getattr(response, "headers", None)
        if isinstance(headers, dict):
            parsed = _coerce_positive_int(headers.get("retry-after") or headers.get("Retry-After"))
            if parsed is not None:
                return parsed
        else:
            raw = None
            get_header = getattr(headers, "get", None)
            if callable(get_header):
                raw = get_header("Retry-After") or get_header("retry-after")
            parsed = _coerce_positive_int(raw)
            if parsed is not None:
                return parsed

    retry_match = _RETRY_AFTER_PATTERN.search(text)
    if retry_match:
        parsed = _coerce_positive_int(retry_match.group(1))
        if parsed is not None:
            return parsed

    seconds_match = _SECONDS_PATTERN.search(text)
    if seconds_match:
        parsed = _coerce_positive_int(seconds_match.group(1))
        if parsed is not None:
            return parsed

    return None


def _is_quota_error(message: str, provider_status: int | None) -> bool:
    lowered = message.lower()
    quota_tokens = (
        "quota",
        "resource_exhausted",
        "exhausted",
        "rate limit",
        "too many requests",
        "exceeded",
    )
    quota_like = any(token in lowered for token in quota_tokens)
    if provider_status == 429 and quota_like:
        return True
    if provider_status in (403, 429) and ("quota" in lowered or "resource_exhausted" in lowered):
        return True
    if quota_like and "429" in lowered:
        return True
    return False


def classify_provider_error(
    exc: Exception,
    *,
    stage: Literal["initialization", "request"],
    model_name: str,
) -> dict[str, Any]:
    """Classify a provider exception into a structured error dict."""
    raw_message = str(exc).strip() or exc.__class__.__name__
    provider_status = _extract_provider_status(exc, raw_message)
    retry_after_sec = _extract_retry_after_sec(exc, raw_message)
    message_lower = raw_message.lower()

    details: dict[str, Any] = {
        "error": raw_message,
        "model": model_name,
        "stage": stage,
    }
    if provider_status is not None:
        details["providerStatus"] = provider_status
    if retry_after_sec is not None:
        details["retryAfterSec"] = retry_after_sec

    if _is_quota_error(raw_message, provider_status):
        return {
            "status_code": 429,
            "code": "ai_quota_exceeded",
            "message": "AI provider quota exceeded",
            "details": details,
        }

    timeout_like = (
        isinstance(exc, TimeoutError)
        or "timeout" in message_lower
        or "timed out" in message_lower
        or "deadline exceeded" in message_lower
    )
    if timeout_like and retry_after_sec is None:
        details["retryAfterSec"] = 1

    return {
        "status_code": 502,
        "code": "ai_upstream_error",
        "message": "AI provider request failed",
        "details": details,
    }


# ---------------------------------------------------------------------------
# High-level generation
# ---------------------------------------------------------------------------


class GeminiError(Exception):
    """Raised when the Gemini provider fails."""

    def __init__(self, status_code: int, code: str, message: str, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.details = details or {}


def _create_client_tuple(
    *,
    model_name: str,
    api_key: str,
    system_instruction: str | None = None,
    response_mime_type: str | None = None,
) -> tuple[Any, str, dict[str, Any] | None]:
    """Create a (client, model, config) tuple. Raises GeminiError if SDK unavailable."""
    try:
        from google import genai
    except Exception as exc:
        raise GeminiError(
            503, "ai_sdk_unavailable", "AI SDK is not installed",
        ) from exc

    client = genai.Client(api_key=api_key)
    config: dict[str, Any] = {}
    if system_instruction:
        config["system_instruction"] = system_instruction
    if response_mime_type:
        config["response_mime_type"] = response_mime_type
    return (client, model_name, config or None)


async def generate_content_text(
    *,
    prompt: str,
    system_instruction: str | None = None,
    response_mime_type: str | None = None,
    api_key: str | None = None,
    model_override: str | None = None,
) -> str | None:
    """Generate text via the Gemini SDK, trying the model chain.

    Raises GeminiError on failure. Returns None only if all models return empty.
    """
    resolved_key = api_key or get_api_key()
    if not resolved_key:
        raise GeminiError(503, "ai_unavailable", "AI provider not configured")

    models = [model_override] if model_override else resolve_model_chain()
    last_provider_error: dict[str, Any] | None = None
    got_empty_payload = False
    t0 = time.perf_counter()

    for model_name in models:
        try:
            client, resolved_model, config = _create_client_tuple(
                model_name=model_name,
                api_key=resolved_key,
                system_instruction=system_instruction,
                response_mime_type=response_mime_type,
            )
        except GeminiError:
            raise
        except Exception as exc:
            last_provider_error = classify_provider_error(
                exc, stage="initialization", model_name=model_name,
            )
            record_ai_error("generate", error_type="init_error")
            continue

        try:
            response = await run_in_threadpool(
                client.models.generate_content,
                model=resolved_model,
                contents=prompt,
                config=config,
            )
        except GeminiError:
            raise
        except Exception as exc:
            last_provider_error = classify_provider_error(
                exc, stage="request", model_name=model_name,
            )
            error_type = last_provider_error.get("code", "unknown") if last_provider_error else "unknown"
            record_ai_error("generate", error_type=error_type)
            continue

        text = extract_sdk_text(response)
        if text:
            record_ai_request("generate", time.perf_counter() - t0)
            return text
        got_empty_payload = True

    if last_provider_error is not None:
        raise GeminiError(
            last_provider_error.get("status_code", 502),
            last_provider_error.get("code", "ai_upstream_error"),
            last_provider_error.get("message", "AI provider request failed"),
            last_provider_error.get("details"),
        )

    if got_empty_payload:
        record_ai_error("generate", error_type="empty_payload")
        raise GeminiError(502, "ai_invalid_response", "AI provider returned empty payload")

    record_ai_error("generate", error_type="all_failed")
    raise GeminiError(
        502, "ai_upstream_error", "AI provider request failed",
        {"error": "No AI model attempts were successful."},
    )
