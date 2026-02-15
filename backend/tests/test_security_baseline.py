from app.core.config import settings


def _signup(client, csrf_headers, email: str = "security@example.com") -> None:
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert response.status_code == 200


def test_csrf_blocks_cookie_auth_mutation_without_header(client, csrf_headers):
    _signup(client, csrf_headers, email="csrf-missing@example.com")

    # Cookie-auth request without X-CSRF-Token must be rejected.
    response = client.post("/api/v1/auth/logout")
    assert response.status_code == 403
    body = response.json()
    assert body["code"] == "csrf_invalid"


def test_security_headers_include_csp_and_baseline_policies(client):
    response = client.get("/api/v1/health")
    assert response.status_code in (200, 503)
    assert response.headers.get("X-Frame-Options") == "DENY"
    assert response.headers.get("Referrer-Policy") == "strict-origin-when-cross-origin"
    assert response.headers.get("Permissions-Policy") == "geolocation=(), microphone=(), camera=()"
    csp = response.headers.get("Content-Security-Policy")
    assert csp == settings.content_security_policy
    assert "script-src-attr 'none'" in csp
    assert "style-src-attr 'unsafe-inline'" in csp
