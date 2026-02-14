from app.core.config import settings


def test_metrics_requires_token_when_configured(client):
    prev_enabled = settings.metrics_enabled
    prev_token = settings.metrics_token
    prev_allowed = settings.metrics_allowed_ips
    try:
        settings.metrics_enabled = True
        settings.metrics_token = "metrics-test-token"
        settings.metrics_allowed_ips = ""

        denied = client.get("/metrics")
        assert denied.status_code == 404

        granted = client.get("/metrics", headers={"X-Metrics-Token": "metrics-test-token"})
        assert granted.status_code == 200
    finally:
        settings.metrics_enabled = prev_enabled
        settings.metrics_token = prev_token
        settings.metrics_allowed_ips = prev_allowed


def test_metrics_can_be_restricted_by_ip(client):
    prev_enabled = settings.metrics_enabled
    prev_token = settings.metrics_token
    prev_allowed = settings.metrics_allowed_ips
    try:
        settings.metrics_enabled = True
        settings.metrics_token = "metrics-test-token"
        settings.metrics_allowed_ips = "127.0.0.1"

        denied = client.get("/metrics", headers={"X-Metrics-Token": "metrics-test-token"})
        assert denied.status_code == 404
    finally:
        settings.metrics_enabled = prev_enabled
        settings.metrics_token = prev_token
        settings.metrics_allowed_ips = prev_allowed
