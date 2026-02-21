from app.services import ai_rate_limiter as rl_module
from app.core.config import settings


def _signup(client, csrf_headers, email: str) -> None:
    response = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert response.status_code == 200


def _logout(client, csrf_headers) -> None:
    response = client.post("/api/v1/auth/logout", headers=csrf_headers())
    assert response.status_code == 200


def test_ai_hunter_user_daily_limit_is_isolated_per_user(client, csrf_headers):
    prev_daily_max = settings.ai_user_daily_max
    prev_daily_window = settings.ai_user_daily_window_sec
    prev_burst_max = settings.ai_rate_limit_max
    prev_burst_window = settings.ai_rate_limit_window_sec
    prev_key = settings.gemini_api_key

    try:
        settings.ai_user_daily_max = 1
        settings.ai_user_daily_window_sec = 86_400
        settings.ai_rate_limit_max = 1000
        settings.ai_rate_limit_window_sec = 60
        settings.gemini_api_key = ""

        rl_module._user_daily_hits.clear()
        rl_module._user_burst_hits.clear()

        _signup(client, csrf_headers, "ai-limit-user1@example.com")

        first = client.post(
            "/api/v1/ai/hunter",
            json={"mensagem": "Hunter: plano de estudo SQL"},
            headers=csrf_headers(),
        )
        assert first.status_code == 503
        assert first.json()["code"] == "ai_unavailable"

        second = client.post(
            "/api/v1/ai/hunter",
            json={"mensagem": "Hunter: plano de estudo Python"},
            headers=csrf_headers(),
        )
        assert second.status_code == 429
        second_body = second.json()
        assert second_body["code"] == "rate_limited"
        assert second_body["details"]["scope"] == "ai_user_daily"

        _logout(client, csrf_headers)
        _signup(client, csrf_headers, "ai-limit-user2@example.com")

        third = client.post(
            "/api/v1/ai/hunter",
            json={"mensagem": "Hunter: nova conta, novo ciclo"},
            headers=csrf_headers(),
        )
        assert third.status_code == 503
        assert third.json()["code"] == "ai_unavailable"
    finally:
        settings.ai_user_daily_max = prev_daily_max
        settings.ai_user_daily_window_sec = prev_daily_window
        settings.ai_rate_limit_max = prev_burst_max
        settings.ai_rate_limit_window_sec = prev_burst_window
        settings.gemini_api_key = prev_key
        rl_module._user_daily_hits.clear()
        rl_module._user_burst_hits.clear()


def test_ai_hunter_user_burst_limit(client, csrf_headers):
    prev_daily_max = settings.ai_user_daily_max
    prev_daily_window = settings.ai_user_daily_window_sec
    prev_burst_max = settings.ai_rate_limit_max
    prev_burst_window = settings.ai_rate_limit_window_sec
    prev_key = settings.gemini_api_key

    try:
        settings.ai_user_daily_max = 1000
        settings.ai_user_daily_window_sec = 86_400
        settings.ai_rate_limit_max = 1
        settings.ai_rate_limit_window_sec = 3600
        settings.gemini_api_key = ""

        rl_module._user_daily_hits.clear()
        rl_module._user_burst_hits.clear()

        _signup(client, csrf_headers, "ai-burst-user@example.com")

        first = client.post(
            "/api/v1/ai/hunter",
            json={"mensagem": "Hunter: primeiro ping"},
            headers=csrf_headers(),
        )
        assert first.status_code == 503
        assert first.json()["code"] == "ai_unavailable"

        second = client.post(
            "/api/v1/ai/hunter",
            json={"mensagem": "Hunter: segundo ping"},
            headers=csrf_headers(),
        )
        assert second.status_code == 429
        second_body = second.json()
        assert second_body["code"] == "rate_limited"
        assert second_body["details"]["scope"] == "ai_user_burst"
    finally:
        settings.ai_user_daily_max = prev_daily_max
        settings.ai_user_daily_window_sec = prev_daily_window
        settings.ai_rate_limit_max = prev_burst_max
        settings.ai_rate_limit_window_sec = prev_burst_window
        settings.gemini_api_key = prev_key
        rl_module._user_daily_hits.clear()
        rl_module._user_burst_hits.clear()
