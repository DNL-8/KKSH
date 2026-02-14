from app.core.config import settings


def _signup(client, csrf_headers, email="missions-fallback@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200


def test_missions_regenerate_fallback_without_gemini_key(client, csrf_headers):
    _signup(client, csrf_headers)

    prev_key = settings.gemini_api_key
    try:
        settings.gemini_api_key = ""
        r = client.post(
            "/api/v1/missions/regenerate",
            json={"cycle": "both", "reason": "fallback_test"},
            headers=csrf_headers(),
        )
    finally:
        settings.gemini_api_key = prev_key

    assert r.status_code == 200
    body = r.json()
    assert body["source"] == "fallback"
    assert len(body["dailyQuests"]) == 5
    assert len(body["weeklyQuests"]) == 5
    assert all(
        (q.get("source") or "fallback") in {"fallback", "mixed"} for q in body["dailyQuests"]
    )
    assert all(
        (q.get("source") or "fallback") in {"fallback", "mixed"} for q in body["weeklyQuests"]
    )
