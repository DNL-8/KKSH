from app.core.config import settings
from app.core.secrets import (
    decrypt_secret,
    decrypt_webhook_secret,
    encrypt_secret,
    encrypt_webhook_secret,
)


def test_decrypt_secret_accepts_previous_rotation_key():
    prev_current = settings.webhook_secret_enc_key
    prev_prev = settings.webhook_secret_enc_key_prev
    prev_key_id = settings.webhook_secret_key_id

    try:
        settings.webhook_secret_enc_key = "old-key-material"
        settings.webhook_secret_enc_key_prev = ""
        settings.webhook_secret_key_id = "old"
        legacy = encrypt_secret("hunter-secret")

        settings.webhook_secret_enc_key = "new-key-material"
        settings.webhook_secret_enc_key_prev = "old-key-material"
        settings.webhook_secret_key_id = "new"

        assert decrypt_secret(legacy) == "hunter-secret"
    finally:
        settings.webhook_secret_enc_key = prev_current
        settings.webhook_secret_enc_key_prev = prev_prev
        settings.webhook_secret_key_id = prev_key_id


def test_decrypt_webhook_secret_accepts_previous_rotation_key():
    prev_current = settings.webhook_secret_enc_key
    prev_prev = settings.webhook_secret_enc_key_prev
    prev_key_id = settings.webhook_secret_key_id

    try:
        settings.webhook_secret_enc_key = "legacy-webhook-key"
        settings.webhook_secret_enc_key_prev = ""
        settings.webhook_secret_key_id = "legacy"
        legacy_cipher, _ = encrypt_webhook_secret("whsec_123")

        settings.webhook_secret_enc_key = "active-webhook-key"
        settings.webhook_secret_enc_key_prev = "legacy-webhook-key"
        settings.webhook_secret_key_id = "active"

        assert decrypt_webhook_secret(legacy_cipher) == "whsec_123"
    finally:
        settings.webhook_secret_enc_key = prev_current
        settings.webhook_secret_enc_key_prev = prev_prev
        settings.webhook_secret_key_id = prev_key_id
