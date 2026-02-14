def _signup(client, csrf_headers, email="achievements@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200


def test_achievements_endpoint_no_longer_raises_500(client, csrf_headers):
    _signup(client, csrf_headers)

    initial = client.get("/api/v1/achievements")
    assert initial.status_code == 200
    rows = initial.json()
    assert isinstance(rows, list)
    assert any(a["key"] == "first_session" for a in rows)

    created = client.post(
        "/api/v1/sessions",
        json={"subject": "SQL", "minutes": 20, "mode": "pomodoro"},
        headers=csrf_headers(),
    )
    assert created.status_code == 201

    after = client.get("/api/v1/achievements")
    assert after.status_code == 200
    unlocked = {a["key"]: bool(a["unlocked"]) for a in after.json()}
    assert unlocked.get("first_session") is True
