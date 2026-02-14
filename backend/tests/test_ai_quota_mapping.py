from app.api.v1 import ai as ai_module


class _QuotaModel:
    def generate_content(self, _: str):
        raise RuntimeError("429 RESOURCE_EXHAUSTED: quota exceeded, retry after 7 seconds")


class _UpstreamErrorModel:
    def generate_content(self, _: str):
        raise RuntimeError("upstream connection reset by peer")


def test_ai_hunter_maps_provider_quota_to_429(client, csrf_headers, monkeypatch):
    ai_module._guest_daily_hits.clear()
    monkeypatch.setattr(ai_module, "_create_model", lambda **_: _QuotaModel())

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

    ai_module._guest_daily_hits.clear()


def test_ai_hunter_keeps_502_for_non_quota_upstream_errors(client, csrf_headers, monkeypatch):
    ai_module._guest_daily_hits.clear()
    monkeypatch.setattr(ai_module, "_create_model", lambda **_: _UpstreamErrorModel())

    response = client.post(
        "/api/v1/ai/hunter",
        json={"mensagem": "Hunter: atualizar status"},
        headers=csrf_headers(),
    )

    assert response.status_code == 502
    body = response.json()
    assert body["code"] == "ai_upstream_error"
    assert "Retry-After" not in response.headers

    ai_module._guest_daily_hits.clear()
