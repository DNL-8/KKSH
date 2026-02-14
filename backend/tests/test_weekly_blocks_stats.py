from __future__ import annotations


def _signup(client, csrf_headers, email="weekly@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200
    return r.json()


def test_weekly_quests_can_be_claimed_after_progress(client, csrf_headers):
    _signup(client, csrf_headers)

    state = client.get("/api/v1/me/state").json()
    assert "weeklyQuests" in state
    assert state["weeklyQuests"], "Expected at least one weekly quest"

    q = state["weeklyQuests"][0]
    qid = q["id"]
    subject = q["subject"]

    # claiming before completion should fail (unless already completed)
    if q["progressMinutes"] < q["targetMinutes"]:
        r = client.post(f"/api/v1/weekly-quests/{qid}/claim", headers=csrf_headers())
        assert r.status_code == 400

    remaining = max(0, q["targetMinutes"] - q["progressMinutes"])
    if remaining > 0:
        r = client.post(
            "/api/v1/sessions",
            json={"subject": subject, "minutes": remaining, "mode": "pomodoro"},
            headers=csrf_headers(),
        )
        assert r.status_code == 201

    r = client.post(f"/api/v1/weekly-quests/{qid}/claim", headers=csrf_headers())
    assert r.status_code == 204

    # idempotent
    r = client.post(f"/api/v1/weekly-quests/{qid}/claim", headers=csrf_headers())
    assert r.status_code == 204


def test_study_blocks_crud(client, csrf_headers):
    _signup(client, csrf_headers, email="blocks@example.com")

    # create
    r = client.post(
        "/api/v1/study-blocks",
        json={
            "dayOfWeek": 0,
            "startTime": "19:30",
            "durationMin": 60,
            "subject": "SQL",
            "mode": "pomodoro",
            "isActive": True,
        },
        headers=csrf_headers(),
    )
    assert r.status_code == 201
    b = r.json()
    assert b["subject"] == "SQL"

    # list
    rows = client.get("/api/v1/study-blocks").json()
    assert len(rows) == 1
    assert rows[0]["id"] == b["id"]

    # update
    r = client.patch(
        f"/api/v1/study-blocks/{b['id']}",
        json={"subject": "Python", "durationMin": 90},
        headers=csrf_headers(),
    )
    assert r.status_code == 200
    b2 = r.json()
    assert b2["subject"] == "Python"
    assert b2["durationMin"] == 90

    # delete
    r = client.delete(f"/api/v1/study-blocks/{b['id']}", headers=csrf_headers())
    assert r.status_code == 204

    rows2 = client.get("/api/v1/study-blocks").json()
    assert rows2 == []


def test_review_stats_increment(client, csrf_headers):
    _signup(client, csrf_headers, email="stats@example.com")

    s0 = client.get("/api/v1/reviews/stats").json()
    assert s0["totalAnswered"] == 0

    # answer one review
    r = client.post(
        "/api/v1/drills/review",
        json={"drillId": "sql-joins-1", "result": "good", "elapsedMs": 1234, "difficulty": 3},
        headers=csrf_headers(),
    )
    assert r.status_code == 204

    s1 = client.get("/api/v1/reviews/stats").json()
    assert s1["totalAnswered"] == 1
    assert s1["goodCount"] == 1
    assert s1["againCount"] == 0
    assert s1["goodRate"] == 1.0
    assert s1["avgTimeMs"] is not None
    assert s1["avgTimeMs"] >= 1234
