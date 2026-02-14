from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _normalize_key_material(raw: str) -> bytes:
    value = raw.strip()
    if not value:
        # Dev/test fallback so local environments keep working.
        value = settings.jwt_secret

    # Accept both raw passphrase and already base64-url keys.
    try:
        decoded = base64.urlsafe_b64decode(value.encode("utf-8"))
        if len(decoded) == 32:
            return value.encode("utf-8")
    except Exception:
        pass

    digest = hashlib.sha256(value.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _fernet() -> Fernet:
    key = _normalize_key_material(settings.webhook_secret_enc_key)
    return Fernet(key)


def encrypt_webhook_secret(secret: str) -> tuple[str, str]:
    if not secret:
        return "", settings.webhook_secret_key_id or "v1"
    token = _fernet().encrypt(secret.encode("utf-8")).decode("utf-8")
    return token, settings.webhook_secret_key_id or "v1"


def decrypt_webhook_secret(secret_encrypted: str | None) -> str | None:
    if not secret_encrypted:
        return None
    try:
        value = _fernet().decrypt(secret_encrypted.encode("utf-8"))
        return value.decode("utf-8")
    except InvalidToken:
        return None
