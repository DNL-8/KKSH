def _payload(name: str = "LCP") -> dict[str, object]:
    return {
        "name": name,
        "value": 1234.56,
        "rating": "good",
        "id": "v1-abc",
        "path": "/today",
        "userAgent": "Playwright/Test",
    }


def test_web_vitals_accepts_beacon_without_csrf(client):
    res = client.post("/api/v1/reports/web-vitals", json=_payload())
    assert res.status_code == 202
    assert res.json()["ok"] is True


def test_web_vitals_validates_metric_name(client):
    res = client.post("/api/v1/reports/web-vitals", json=_payload(name="FID"))
    assert res.status_code == 422


def test_web_vitals_accepts_authenticated_session_without_csrf_header(client, csrf_headers):
    signup = client.post(
        "/api/v1/auth/signup",
        json={"email": "vitals@example.com", "password": "test123"},
        headers=csrf_headers(),
    )
    assert signup.status_code == 200

    # Endpoint is intentionally CSRF-exempt to support sendBeacon.
    res = client.post("/api/v1/reports/web-vitals", json=_payload("INP"))
    assert res.status_code == 202
