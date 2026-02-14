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
