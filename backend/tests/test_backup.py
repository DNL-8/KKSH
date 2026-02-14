def _signup(client, csrf_headers, email="backup@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200


def test_backup_export_ignores_soft_deleted_sessions(client, csrf_headers):
    _signup(client, csrf_headers)

    created = client.post(
        "/api/v1/sessions",
        json={"subject": "SQL", "minutes": 30, "mode": "pomodoro"},
        headers=csrf_headers(),
    )
    assert created.status_code == 201

    session_id = client.get("/api/v1/sessions").json()["sessions"][0]["id"]
    deleted = client.delete(f"/api/v1/sessions/{session_id}", headers=csrf_headers())
    assert deleted.status_code == 204

    exported = client.get("/api/v1/backup/export")
    assert exported.status_code == 200
    assert exported.json()["sessions"] == []


def test_backup_import_rejects_large_payload(client, csrf_headers):
    _signup(client, csrf_headers, email="backup-large@example.com")

    large_goal_key = "x" * 1_100_000
    payload = {
        "version": 1,
        "goals": {large_goal_key: 10},
        "sessions": [],
        "dailyQuests": [],
        "drillReviews": [],
        "customDrills": [],
    }
    imported = client.post("/api/v1/backup/import", json=payload, headers=csrf_headers())
    assert imported.status_code == 413
    body = imported.json()
    assert body["code"] == "backup_payload_too_large"


def test_backup_import_rejects_too_many_sessions(client, csrf_headers):
    _signup(client, csrf_headers, email="backup-many@example.com")

    sessions = []
    for idx in range(5001):
        sessions.append(
            {
                "id": f"s-{idx}",
                "subject": "SQL",
                "minutes": 25,
                "mode": "pomodoro",
                "notes": None,
                "date": "2026-02-13",
                "startedAt": "2026-02-13T10:00:00Z",
                "createdAt": "2026-02-13T10:00:00Z",
            }
        )

    payload = {
        "version": 1,
        "goals": {"SQL": 60},
        "sessions": sessions,
        "dailyQuests": [],
        "drillReviews": [],
        "customDrills": [],
    }
    imported = client.post("/api/v1/backup/import", json=payload, headers=csrf_headers())
    assert imported.status_code == 422
