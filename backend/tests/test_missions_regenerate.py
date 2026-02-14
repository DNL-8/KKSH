from app.core.config import settings


def _signup(client, csrf_headers, email="missions@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200


def test_missions_regenerate_generates_five_plus_five_and_unique_subjects(client, csrf_headers):
    _signup(client, csrf_headers, email="missions-generate@example.com")

    prev_key = settings.gemini_api_key
    try:
        settings.gemini_api_key = ""
        r = client.post(
            "/api/v1/missions/regenerate",
            json={"cycle": "both", "reason": "test_full"},
            headers=csrf_headers(),
        )
    finally:
        settings.gemini_api_key = prev_key

    assert r.status_code == 200
    body = r.json()

    assert body["source"] in {"fallback", "mixed", "gemini"}
    assert len(body["dailyQuests"]) == 5
    assert len(body["weeklyQuests"]) == 5

    daily_subjects = [q["subject"].strip().lower() for q in body["dailyQuests"]]
    weekly_subjects = [q["subject"].strip().lower() for q in body["weeklyQuests"]]
    assert len(set(daily_subjects)) == 5
    assert len(set(weekly_subjects)) == 5

    sample_daily = body["dailyQuests"][0]
    assert sample_daily["title"]
    assert sample_daily["description"]
    assert sample_daily["rank"] in {"F", "E", "D", "C", "B", "A", "S"}
    assert sample_daily["difficulty"] in {"easy", "medium", "hard", "elite"}
    assert isinstance(sample_daily["rewardXp"], int)
    assert isinstance(sample_daily["rewardGold"], int)
