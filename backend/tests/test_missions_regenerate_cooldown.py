from app.core.config import settings


def _signup(client, csrf_headers, email="missions-cooldown@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200


def test_missions_regenerate_respects_cooldown(client, csrf_headers):
    _signup(client, csrf_headers)

    prev_key = settings.gemini_api_key
    prev_cooldown = settings.ai_mission_regen_cooldown_sec
    try:
        settings.gemini_api_key = ""
        settings.ai_mission_regen_cooldown_sec = 3600

        first = client.post(
            "/api/v1/missions/regenerate",
            json={"cycle": "both", "reason": "cooldown_1"},
            headers=csrf_headers(),
        )
        assert first.status_code == 200

        second = client.post(
            "/api/v1/missions/regenerate",
            json={"cycle": "daily", "reason": "cooldown_2"},
            headers=csrf_headers(),
        )
        assert second.status_code == 429
        body = second.json()
        assert body["code"] == "rate_limited"
        assert body["details"]["scope"] == "ai_mission_regen"
        assert body["details"].get("nextAllowedAt")
    finally:
        settings.gemini_api_key = prev_key
        settings.ai_mission_regen_cooldown_sec = prev_cooldown
