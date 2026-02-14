from app.core.config import settings


def _signup(client, csrf_headers, email="ai@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200


def test_ai_text_requires_auth(client, csrf_headers):
    r = client.post(
        "/api/v1/ai/text",
        json={"prompt": "Teste rapido"},
        headers=csrf_headers(),
    )
    assert r.status_code == 401


def test_ai_text_returns_503_when_provider_is_not_configured(client, csrf_headers):
    _signup(client, csrf_headers, email="ai-config@example.com")

    prev_key = settings.gemini_api_key
    try:
        settings.gemini_api_key = ""
        r = client.post(
            "/api/v1/ai/text",
            json={"prompt": "Teste rapido"},
            headers=csrf_headers(),
        )
        assert r.status_code == 503
        body = r.json()
        assert body["code"] == "ai_unavailable"
    finally:
        settings.gemini_api_key = prev_key


def test_ai_hunter_allows_guest_and_returns_503_when_provider_is_not_configured(
    client, csrf_headers
):
    prev_key = settings.gemini_api_key
    try:
        settings.gemini_api_key = ""
        r = client.post(
            "/api/v1/ai/hunter",
            json={"mensagem": "Hunter: conclui SQL hoje"},
            headers=csrf_headers(),
        )
        assert r.status_code == 503
        body = r.json()
        assert body["code"] == "ai_unavailable"
    finally:
        settings.gemini_api_key = prev_key


def test_chat_alias_allows_guest_and_returns_503_when_provider_is_not_configured(
    client, csrf_headers
):
    prev_key = settings.gemini_api_key
    try:
        settings.gemini_api_key = ""
        r = client.post(
            "/chat",
            json={"mensagem": "Hunter: finalizei uma tarefa"},
            headers=csrf_headers(),
        )
        assert r.status_code == 503
        body = r.json()
        assert body["code"] == "ai_unavailable"
        assert r.headers.get("Deprecation") == "true"
        assert r.headers.get("Link") == '</api/v1/chat>; rel="successor-version"'
    finally:
        settings.gemini_api_key = prev_key


def test_api_v1_chat_allows_guest_and_returns_503_when_provider_is_not_configured(
    client, csrf_headers
):
    prev_key = settings.gemini_api_key
    try:
        settings.gemini_api_key = ""
        r = client.post(
            "/api/v1/chat",
            json={"mensagem": "Hunter: finalizei uma tarefa"},
            headers=csrf_headers(),
        )
        assert r.status_code == 503
        body = r.json()
        assert body["code"] == "ai_unavailable"
    finally:
        settings.gemini_api_key = prev_key
