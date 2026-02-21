from app.services import ai_rate_limiter as rl_module
from app.services import gemini_client as gc_module


class _QuotaModels:
    """Stub for client.models that raises a quota error."""
    def generate_content(self, *, model, contents, config=None):
        raise RuntimeError("429 RESOURCE_EXHAUSTED: quota exceeded, retry after 7 seconds")


class _QuotaClient:
    models = _QuotaModels()


class _UpstreamModels:
    """Stub for client.models that raises a non-quota error."""
    def generate_content(self, *, model, contents, config=None):
        raise RuntimeError("upstream connection reset by peer")


class _UpstreamClient:
    models = _UpstreamModels()


def test_ai_hunter_maps_provider_quota_to_429(client, csrf_headers, monkeypatch):
    rl_module._guest_daily_hits.clear()
    monkeypatch.setattr(
        gc_module, "_create_client_tuple",
        lambda **_: (_QuotaClient(), "gemini-2.0-flash", {}),
    )
    monkeypatch.setattr(gc_module, "get_api_key", lambda **kwargs: "fake-key")

    response = client.post(
        "/api/v1/ai/hunter",
        json={"mensagem": "Hunter: gerar estrategia de estudo"},
        headers=csrf_headers(),
    )

    assert response.status_code == 429
    body = response.json()
    assert body["code"] == "ai_quota_exceeded"
    assert body["details"]["retryAfterSec"] == 7
    assert body["details"]["providerStatus"] == 429
    assert response.headers.get("Retry-After") == "7"

    rl_module._guest_daily_hits.clear()


def test_ai_hunter_keeps_502_for_non_quota_upstream_errors(client, csrf_headers, monkeypatch):
    rl_module._guest_daily_hits.clear()
    monkeypatch.setattr(
        gc_module, "_create_client_tuple",
        lambda **_: (_UpstreamClient(), "gemini-2.0-flash", {}),
    )
    monkeypatch.setattr(gc_module, "get_api_key", lambda **kwargs: "fake-key")

    response = client.post(
        "/api/v1/ai/hunter",
        json={"mensagem": "Hunter: atualizar status"},
        headers=csrf_headers(),
    )

    assert response.status_code == 502
    body = response.json()
    assert body["code"] == "ai_upstream_error"
    assert "Retry-After" not in response.headers

    rl_module._guest_daily_hits.clear()
