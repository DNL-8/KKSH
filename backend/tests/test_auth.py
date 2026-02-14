from datetime import datetime, timedelta, timezone

import jwt

from app.core.config import settings
from app.core.security import create_refresh_token


def test_auth_flow(client, csrf_headers):
    # signup
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": "a@example.com", "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["email"] == "a@example.com"

    # cookies should exist
    assert "access_token" in client.cookies
    assert "refresh_token" in client.cookies

    # me
    r = client.get("/api/v1/me")
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "a@example.com"

    # logout
    r = client.post("/api/v1/auth/logout", headers=csrf_headers())
    assert r.status_code == 200
    assert r.json()["ok"] is True

    # optional profile endpoint should now return anonymous payload
    r = client.get("/api/v1/me")
    assert r.status_code == 200
    assert r.json()["user"] is None

    # protected state endpoint should fail after logout
    r = client.get("/api/v1/me/state")
    assert r.status_code == 401

    # login
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "a@example.com", "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200

    # refresh
    r = client.post("/api/v1/auth/refresh", headers=csrf_headers())
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "a@example.com"


def test_signup_rejects_case_insensitive_duplicate_email(client, csrf_headers):
    r1 = client.post(
        "/api/v1/auth/signup",
        json={"email": "Case@Test.com", "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r1.status_code == 200
    assert r1.json()["user"]["email"] == "case@test.com"

    r2 = client.post(
        "/api/v1/auth/signup",
        json={"email": "case@test.com", "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r2.status_code == 409


def test_refresh_tokens_include_unique_jti_even_same_second(monkeypatch):
    import app.core.security as security_module

    class _FrozenDatetime(datetime):
        @classmethod
        def now(cls, tz=None):  # noqa: D401
            return datetime(2026, 1, 1, 0, 0, 0, tzinfo=timezone.utc)

    monkeypatch.setattr(security_module, "datetime", _FrozenDatetime)

    t1 = create_refresh_token("user-1")
    t2 = create_refresh_token("user-1")
    assert t1 != t2

    p1 = jwt.decode(
        t1,
        settings.jwt_secret,
        algorithms=["HS256"],
        options={"verify_exp": False},
    )
    p2 = jwt.decode(
        t2,
        settings.jwt_secret,
        algorithms=["HS256"],
        options={"verify_exp": False},
    )
    assert isinstance(p1.get("jti"), str) and p1["jti"]
    assert isinstance(p2.get("jti"), str) and p2["jti"]
    assert p1["jti"] != p2["jti"]


def test_refresh_accepts_legacy_token_without_jti(client, csrf_headers):
    signup = client.post(
        "/api/v1/auth/signup",
        json={"email": "legacy@example.com", "password": "secret123"},
        headers=csrf_headers(),
    )
    assert signup.status_code == 200
    user_id = signup.json()["user"]["id"]

    now = datetime.now(timezone.utc)
    legacy_payload = {
        "sub": user_id,
        "type": "refresh",
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(days=settings.refresh_token_expire_days)).timestamp()),
    }
    legacy_token = jwt.encode(legacy_payload, settings.jwt_secret, algorithm="HS256")
    client.cookies.set("refresh_token", legacy_token)

    refreshed = client.post("/api/v1/auth/refresh", headers=csrf_headers())
    assert refreshed.status_code == 200
    assert refreshed.json()["user"]["id"] == user_id
