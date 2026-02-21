from sqlmodel import select

from app.core.audit import idempotency_key_hash
from app.db import get_session
from app.models import AuditEvent, RewardClaim, UserSettings, UserStats, XpLedgerEvent


def _signup(client, csrf_headers, email="backend-first@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200
    return r.json()["user"]["id"]


def _headers(csrf_headers, idem: str):
    h = csrf_headers()
    h["Idempotency-Key"] = idem
    return h


def test_progress_endpoint_returns_backend_rank(client, csrf_headers):
    _signup(client, csrf_headers, email="progress-rank@example.com")

    r = client.get("/api/v1/progress")
    assert r.status_code == 200
    body = r.json()
    assert body["level"] == 1
    assert body["rank"] == "F"
    assert "vitals" in body
    assert body["vitals"]["hp"] >= 0


def test_progress_endpoint_is_read_only_when_stats_row_is_missing(client, csrf_headers):
    user_id = _signup(client, csrf_headers, email="progress-readonly@example.com")

    with get_session() as db:
        row = db.exec(select(UserStats).where(UserStats.user_id == user_id)).first()
        assert row is not None
        db.delete(row)
        db.commit()

    r = client.get("/api/v1/progress")
    assert r.status_code == 200
    body = r.json()
    assert body["level"] == 1
    assert body["rank"] == "F"
    assert body["xp"] == 0
    assert body["maxXp"] == 1000
    assert body["gold"] == 0
    assert body["vitals"]["hp"] == 100
    assert body["vitals"]["mana"] == 100
    assert body["vitals"]["fatigue"] == 20

    with get_session() as db:
        row_after = db.exec(select(UserStats).where(UserStats.user_id == user_id)).first()
        assert row_after is None


def test_events_are_idempotent_and_append_single_ledger_row(client, csrf_headers):
    user_id = _signup(client, csrf_headers, email="events-idem@example.com")
    created = client.post(
        "/api/v1/sessions",
        json={"subject": "Excel", "minutes": 12, "mode": "video_lesson"},
        headers=csrf_headers(),
    )
    assert created.status_code == 201
    listed = client.get("/api/v1/sessions?limit=1")
    assert listed.status_code == 200
    session_id = listed.json()["sessions"][0]["id"]
    source_ref = f"session:{session_id}"

    payload = {
        "eventType": "video.lesson.completed",
        "occurredAt": "2026-02-14T15:22:00Z",
        "sourceRef": source_ref,
        "payload": {
            "minutes": 12,
        },
    }
    idem_key = "event-idem-1"

    r1 = client.post(
        "/api/v1/events",
        json=payload,
        headers=_headers(csrf_headers, idem_key),
    )
    assert r1.status_code == 200, r1.json()
    body1 = r1.json()
    assert body1["applied"] is True
    assert body1["xpDelta"] > 0
    assert body1["progress"]["rank"] in {"F", "E", "D", "C", "B", "A", "S"}

    r2 = client.post(
        "/api/v1/events",
        json=payload,
        headers=_headers(csrf_headers, idem_key),
    )
    assert r2.status_code == 200
    body2 = r2.json()
    assert body2 == body1

    with get_session() as db:
        rows = db.exec(
            select(XpLedgerEvent).where(
                XpLedgerEvent.source_type == "event",
                XpLedgerEvent.source_ref == source_ref,
            )
        ).all()
        assert len(rows) == 1
        audit = db.exec(
            select(AuditEvent)
            .where(AuditEvent.user_id == user_id, AuditEvent.event == "event.applied")
            .order_by(AuditEvent.created_at.desc())
        ).first()
        assert audit is not None
        metadata = dict(audit.metadata_json or {})
        assert metadata.get("commandType") == "event.apply_xp"
        assert metadata.get("idempotencyKeyHash") == idempotency_key_hash(idem_key)
        assert idem_key not in str(metadata)


def test_events_require_source_ref_and_idempotency_key(client, csrf_headers):
    _signup(client, csrf_headers, email="events-validation@example.com")

    missing_source = client.post(
        "/api/v1/events",
        json={
            "eventType": "video.lesson.completed",
            "occurredAt": "2026-02-14T15:22:00Z",
            "payload": {"minutes": 5},
        },
        headers=_headers(csrf_headers, "event-missing-source"),
    )
    assert missing_source.status_code == 422
    assert missing_source.json()["code"] == "invalid_event_payload"

    no_idempotency = client.post(
        "/api/v1/events",
        json={
            "eventType": "video.lesson.completed",
            "occurredAt": "2026-02-14T15:22:00Z",
            "sourceRef": "session:missing",
            "payload": {"minutes": 5},
        },
        headers=csrf_headers(),
    )
    assert no_idempotency.status_code == 422
    assert no_idempotency.json()["code"] == "idempotency_key_required"


def test_claim_endpoint_is_idempotent_with_same_key(client, csrf_headers):
    user_id = _signup(client, csrf_headers, email="claim-idem@example.com")

    missions = client.get("/api/v1/missions?cycle=daily")
    assert missions.status_code == 200
    daily = missions.json()["daily"]
    assert daily
    mission = daily[0]
    remaining = max(0, int(mission["targetMinutes"]) - int(mission["progressMinutes"]))

    if remaining > 0:
        s = client.post(
            "/api/v1/sessions",
            json={"subject": mission["subject"], "minutes": remaining, "mode": "pomodoro"},
            headers=csrf_headers(),
        )
        assert s.status_code == 201

    idem_key = "mission-claim-idem-1"
    claim1 = client.post(
        f"/api/v1/missions/{mission['missionInstanceId']}/claim",
        json={"reason": "completed"},
        headers=_headers(csrf_headers, idem_key),
    )
    assert claim1.status_code == 200
    body1 = claim1.json()
    assert body1["reward"]["xp"] >= 0

    claim2 = client.post(
        f"/api/v1/missions/{mission['missionInstanceId']}/claim",
        json={"reason": "completed"},
        headers=_headers(csrf_headers, idem_key),
    )
    assert claim2.status_code == 200
    assert claim2.json() == body1

    with get_session() as db:
        claims = db.exec(
            select(RewardClaim).where(
                RewardClaim.mission_id == mission["missionInstanceId"],
                RewardClaim.mission_cycle == "daily",
            )
        ).all()
        assert len(claims) == 1
        audit = db.exec(
            select(AuditEvent)
            .where(AuditEvent.user_id == user_id, AuditEvent.event == "mission.claim")
            .order_by(AuditEvent.created_at.desc())
        ).first()
        assert audit is not None
        metadata = dict(audit.metadata_json or {})
        assert metadata.get("commandType") == "mission.claim"
        assert metadata.get("idempotencyKeyHash") == idempotency_key_hash(idem_key)
        assert idem_key not in str(metadata)


def test_mission_commands_require_idempotency_key(client, csrf_headers):
    _signup(client, csrf_headers, email="missions-idem-required@example.com")

    missions = client.get("/api/v1/missions?cycle=daily")
    assert missions.status_code == 200
    daily = missions.json()["daily"]
    assert daily
    mission_id = daily[0]["missionInstanceId"]

    start_missing = client.post(
        f"/api/v1/missions/{mission_id}/start",
        json={"context": {"source": "test"}},
        headers=csrf_headers(),
    )
    assert start_missing.status_code == 422
    assert start_missing.json()["code"] == "idempotency_key_required"

    claim_missing = client.post(
        f"/api/v1/missions/{mission_id}/claim",
        json={"reason": "completed"},
        headers=csrf_headers(),
    )
    assert claim_missing.status_code == 422
    assert claim_missing.json()["code"] == "idempotency_key_required"


def test_non_admin_cannot_change_xp_and_gold_per_minute(client, csrf_headers):
    user_id = _signup(client, csrf_headers, email="settings-non-admin@example.com")

    patch = client.patch(
        "/api/v1/me/settings",
        json={"xpPerMinute": 99, "goldPerMinute": 77},
        headers=csrf_headers(),
    )
    assert patch.status_code == 200

    with get_session() as db:
        settings = db.exec(select(UserSettings).where(UserSettings.user_id == user_id)).first()
        assert settings is not None
        assert int(settings.xp_per_minute) == 5
        assert int(settings.gold_per_minute) == 1
