def _signup(client, csrf_headers, email: str):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200


def _logout(client, csrf_headers):
    r = client.post("/api/v1/auth/logout", headers=csrf_headers())
    assert r.status_code == 200


def test_cross_user_resource_isolation(client, csrf_headers):
    _signup(client, csrf_headers, "owner@example.com")

    subject = client.post(
        "/api/v1/subjects",
        json={"name": "Private Subject", "isActive": True},
        headers=csrf_headers(),
    )
    assert subject.status_code == 201
    subject_id = subject.json()["id"]

    block = client.post(
        "/api/v1/study-blocks",
        json={
            "dayOfWeek": 1,
            "startTime": "19:30",
            "durationMin": 60,
            "subject": "Private Subject",
            "mode": "pomodoro",
            "isActive": True,
        },
        headers=csrf_headers(),
    )
    assert block.status_code == 201
    block_id = block.json()["id"]

    created = client.post(
        "/api/v1/sessions",
        json={"subject": "Private Subject", "minutes": 25, "mode": "pomodoro"},
        headers=csrf_headers(),
    )
    assert created.status_code == 201
    sessions = client.get("/api/v1/sessions").json()["sessions"]
    assert sessions
    session_id = sessions[0]["id"]

    webhook = client.post(
        "/api/v1/webhooks",
        json={"url": "https://example.com/hook", "events": ["test"], "isActive": True},
        headers=csrf_headers(),
    )
    assert webhook.status_code == 200
    webhook_id = webhook.json()["id"]

    state = client.get("/api/v1/me/state").json()
    daily_quest_id = state["dailyQuests"][0]["id"]
    weekly_quest_id = state["weeklyQuests"][0]["id"]

    _logout(client, csrf_headers)
    _signup(client, csrf_headers, "other@example.com")

    assert client.get(f"/api/v1/sessions/{session_id}").status_code == 404
    assert (
        client.patch(
            f"/api/v1/study-blocks/{block_id}",
            json={"durationMin": 45},
            headers=csrf_headers(),
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/subjects/{subject_id}",
            json={"name": "Mutated"},
            headers=csrf_headers(),
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/webhooks/{webhook_id}",
            json={"isActive": False},
            headers=csrf_headers(),
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/daily-quests/{daily_quest_id}/claim", headers=csrf_headers()
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/weekly-quests/{weekly_quest_id}/claim", headers=csrf_headers()
        ).status_code
        == 404
    )


def test_input_limits_and_schema_validation(client, csrf_headers):
    _signup(client, csrf_headers, "validation@example.com")

    assert client.get("/api/v1/sessions?limit=0").status_code == 422
    assert client.get("/api/v1/sessions?limit=500").status_code == 422
    assert client.get("/api/v1/drills?limit=500").status_code == 422
    assert client.get("/api/v1/reviews/due?limit=0").status_code == 422

    webhook_invalid_event = client.post(
        "/api/v1/webhooks",
        json={"url": "https://example.com/hook", "events": ["session.unknown"]},
        headers=csrf_headers(),
    )
    assert webhook_invalid_event.status_code == 422

    review_invalid_result = client.post(
        "/api/v1/drills/review",
        json={"drillId": "sql-joins-1", "result": "invalid"},
        headers=csrf_headers(),
    )
    assert review_invalid_result.status_code == 422

    created = client.post(
        "/api/v1/sessions",
        json={"subject": "SQL", "minutes": 25, "mode": "pomodoro"},
        headers=csrf_headers(),
    )
    assert created.status_code == 201
    session_id = client.get("/api/v1/sessions").json()["sessions"][0]["id"]

    invalid_date = client.patch(
        f"/api/v1/sessions/{session_id}",
        json={"date": "2026-13-40"},
        headers=csrf_headers(),
    )
    assert invalid_date.status_code == 422
