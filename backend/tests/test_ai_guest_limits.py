from app.services import ai_rate_limiter as rl_module
from app.core.config import settings


def test_ai_hunter_guest_daily_limit(client, csrf_headers):
    prev_max = settings.ai_guest_daily_max
    prev_window = settings.ai_guest_daily_window_sec
    prev_key = settings.gemini_api_key
    try:
        settings.ai_guest_daily_max = 1
        settings.ai_guest_daily_window_sec = 86_400
        settings.gemini_api_key = ""
        rl_module._guest_daily_hits.clear()

        first = client.post(
            "/api/v1/ai/hunter",
            json={"mensagem": "Hunter, registrar treino SQL"},
            headers=csrf_headers(),
        )
        assert first.status_code == 503
        assert first.json()["code"] == "ai_unavailable"

        second = client.post(
            "/api/v1/ai/hunter",
            json={"mensagem": "Hunter, registrar treino Python"},
            headers=csrf_headers(),
        )
        assert second.status_code == 429
        body = second.json()
        assert body["code"] == "rate_limited"
        assert body["details"]["scope"] == "ai_guest_daily"
    finally:
        settings.ai_guest_daily_max = prev_max
        settings.ai_guest_daily_window_sec = prev_window
        settings.gemini_api_key = prev_key
        rl_module._guest_daily_hits.clear()
