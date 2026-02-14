from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_token(*, sub: str, token_type: str, expires_delta: timedelta) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": sub,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def create_access_token(user_id: str) -> str:
    return create_token(
        sub=user_id,
        token_type="access",
        expires_delta=timedelta(minutes=settings.access_token_expire_min),
    )


def create_refresh_token(user_id: str) -> str:
    return create_token(
        sub=user_id,
        token_type="refresh",
        expires_delta=timedelta(days=settings.refresh_token_expire_days),
    )
