from app.core.config import settings


def _signup(client, csrf_headers, email="missions-migration@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200


def test_missions_regenerate_preserves_progress_and_claim_status(client, csrf_headers):
    _signup(client, csrf_headers)

    state = client.get("/api/v1/me/state").json()
    daily = state["dailyQuests"][0]
    subject = daily["subject"]

    # complete and claim first daily quest
    remaining = max(0, int(daily["targetMinutes"]) - int(daily["progressMinutes"]))
    if remaining > 0:
        r = client.post(
            "/api/v1/sessions",
            json={"subject": subject, "minutes": remaining, "mode": "free"},
            headers=csrf_headers(),
        )
        assert r.status_code == 201

    r = client.post(f"/api/v1/daily-quests/{daily['id']}/claim", headers=csrf_headers())
    assert r.status_code == 204

    # add additional progress to increase migrated minutes
    r = client.post(
        "/api/v1/sessions",
        json={"subject": subject, "minutes": 15, "mode": "free"},
        headers=csrf_headers(),
    )
    assert r.status_code == 201

    pre = client.get("/api/v1/me/state").json()
    pre_total_progress = sum(int(q["progressMinutes"]) for q in pre["dailyQuests"])
    pre_claimed = sum(1 for q in pre["dailyQuests"] if q["claimed"])
    assert pre_claimed >= 1

    prev_key = settings.gemini_api_key
    try:
        settings.gemini_api_key = ""
        regen = client.post(
            "/api/v1/missions/regenerate",
            json={"cycle": "both", "reason": "migration_test"},
            headers=csrf_headers(),
        )
    finally:
        settings.gemini_api_key = prev_key

    assert regen.status_code == 200

    post = client.get("/api/v1/me/state").json()
    post_total_progress = sum(int(q["progressMinutes"]) for q in post["dailyQuests"])
    post_claimed = sum(1 for q in post["dailyQuests"] if q["claimed"])

    assert post_total_progress >= pre_total_progress
    assert post_claimed >= pre_claimed
