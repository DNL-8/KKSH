def _signup(client, csrf_headers, email="reset@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200


def _find_item(rows, item_id: str):
    return next((x for x in rows if x["id"] == item_id), None)


def test_reset_all_clears_progress_missions_and_reviews(client, csrf_headers):
    _signup(client, csrf_headers)

    state0 = client.get("/api/v1/me/state").json()
    subject = state0["dailyQuests"][0]["subject"]

    # Create progress (sessions, rewards and review history).
    r = client.post(
        "/api/v1/sessions",
        json={"subject": subject, "minutes": 15, "mode": "pomodoro"},
        headers=csrf_headers(),
    )
    assert r.status_code == 201

    r = client.post(
        "/api/v1/drills/review",
        json={"drillId": "sql-joins-1", "result": "good"},
        headers=csrf_headers(),
    )
    assert r.status_code == 204

    r = client.post(
        "/api/v1/inventory/use",
        json={"itemId": "coffee", "qty": 1},
        headers=csrf_headers(),
    )
    assert r.status_code == 200

    state1 = client.get("/api/v1/me/state").json()
    assert state1["todayMinutes"] >= 15
    assert state1["weekMinutes"] >= 15
    assert state1["progression"]["xp"] > 0
    assert state1["progression"]["gold"] > 0
    assert _find_item(state1["inventory"], "coffee")["qty"] == 4

    review_stats = client.get("/api/v1/reviews/stats").json()
    assert review_stats["totalAnswered"] >= 1

    r = client.post("/api/v1/me/reset", json={"scopes": ["all"]}, headers=csrf_headers())
    assert r.status_code == 200
    body = r.json()
    assert set(body["applied"]) == {"missions", "progression", "sessions", "inventory", "reviews"}

    state2 = client.get("/api/v1/me/state").json()
    assert state2["todayMinutes"] == 0
    assert state2["weekMinutes"] == 0
    assert state2["streakDays"] == 0
    assert state2["progression"]["level"] == 1
    assert state2["progression"]["xp"] == 0
    assert state2["progression"]["gold"] == 0

    coffee = _find_item(state2["inventory"], "coffee")
    assert coffee is not None
    assert coffee["qty"] == 5

    assert state2["dailyQuests"]
    assert all(q["progressMinutes"] == 0 for q in state2["dailyQuests"])
    assert all(not q["claimed"] for q in state2["dailyQuests"])
    assert state2["weeklyQuests"]
    assert all(q["progressMinutes"] == 0 for q in state2["weeklyQuests"])
    assert all(not q["claimed"] for q in state2["weeklyQuests"])

    review_stats_after = client.get("/api/v1/reviews/stats").json()
    assert review_stats_after["totalAnswered"] == 0

    sessions_after = client.get("/api/v1/sessions").json()
    assert sessions_after["sessions"] == []


def test_reset_missions_scope_clears_quest_progress_without_deleting_sessions(client, csrf_headers):
    _signup(client, csrf_headers, email="reset-missions@example.com")

    state0 = client.get("/api/v1/me/state").json()
    subject = state0["dailyQuests"][0]["subject"]

    r = client.post(
        "/api/v1/sessions",
        json={"subject": subject, "minutes": 20, "mode": "pomodoro"},
        headers=csrf_headers(),
    )
    assert r.status_code == 201

    state1 = client.get("/api/v1/me/state").json()
    row1 = next(q for q in state1["dailyQuests"] if q["subject"] == subject)
    assert row1["progressMinutes"] >= 20
    assert state1["todayMinutes"] >= 20

    r = client.post("/api/v1/me/reset", json={"scopes": ["missions"]}, headers=csrf_headers())
    assert r.status_code == 200
    body = r.json()
    assert body["applied"] == ["missions"]

    state2 = client.get("/api/v1/me/state").json()
    row2 = next(q for q in state2["dailyQuests"] if q["subject"] == subject)
    assert row2["progressMinutes"] == 0
    assert row2["claimed"] is False
    assert state2["todayMinutes"] >= 20
