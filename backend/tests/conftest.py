import os
import pathlib

import pytest

# Ensure test env is set BEFORE importing app modules
os.environ.setdefault("ENV", "test")
os.environ.setdefault("JWT_SECRET", "test-secret-with-32-plus-chars-123456789")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MIN", "5")
os.environ.setdefault("REFRESH_TOKEN_EXPIRE_DAYS", "1")
os.environ.setdefault("AUTO_CREATE_DB", "true")
os.environ.setdefault("CORS_ORIGINS", "http://127.0.0.1:3000")
os.environ.setdefault("RATE_LIMIT_AUTH_MAX", "1000")
os.environ.setdefault("ADMIN_EMAILS", "admin@example.com")

TEST_DB = pathlib.Path(__file__).parent / "test.db"
os.environ.setdefault("DATABASE_URL", f"sqlite:///{TEST_DB}")

# Clean DB file each run
if TEST_DB.exists():
    TEST_DB.unlink()

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture()
def client() -> TestClient:
    with TestClient(app) as c:
        yield c


@pytest.fixture()
def csrf_headers(client: TestClient):
    """Return a helper that fetches a fresh CSRF token and returns the required header."""

    def _headers() -> dict[str, str]:
        r = client.get("/api/v1/auth/csrf")
        assert r.status_code == 200
        token = r.json().get("csrfToken")
        assert token
        return {"X-CSRF-Token": str(token)}

    return _headers
