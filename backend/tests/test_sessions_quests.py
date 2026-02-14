import pytest
from sqlmodel import select

from app.db import get_session
from app.models import AuditEvent, StudySession


def _signup(client, csrf_headers, email="b@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200
    return r.json()


def test_sessions_update_state_and_quests(client, csrf_headers):
    _signup(client, csrf_headers)

    state = client.get("/api/v1/me/state").json()
    assert "dailyQuests" in state
    assert state["todayMinutes"] == 0

    # pick first quest subject
    subject = state["dailyQuests"][0]["subject"]

    r = client.post(
        "/api/v1/sessions",
        json={"subject": subject, "minutes": 10, "mode": "pomodoro"},
        headers=csrf_headers(),
    )
    assert r.status_code == 201

    state2 = client.get("/api/v1/me/state").json()
    assert state2["todayMinutes"] == 10

    # quest progress increased for that subject
    updated = [q for q in state2["dailyQuests"] if q["subject"] == subject]
    assert updated, "Quest for subject should exist"
    assert updated[0]["progressMinutes"] >= 10

    # claiming before completion should fail (unless target <= progress)
    qid = updated[0]["id"]
    if updated[0]["progressMinutes"] < updated[0]["targetMinutes"]:
        r = client.post(f"/api/v1/daily-quests/{qid}/claim", headers=csrf_headers())
        assert r.status_code == 400

    # finish the quest
    remaining = max(0, updated[0]["targetMinutes"] - updated[0]["progressMinutes"])
    if remaining > 0:
        r = client.post(
            "/api/v1/sessions",
            json={"subject": subject, "minutes": remaining, "mode": "pomodoro"},
            headers=csrf_headers(),
        )
        assert r.status_code == 201

    r = client.post(f"/api/v1/daily-quests/{qid}/claim", headers=csrf_headers())
    assert r.status_code == 204

    # idempotent
    r = client.post(f"/api/v1/daily-quests/{qid}/claim", headers=csrf_headers())
    assert r.status_code == 204


def test_create_session_is_atomic_when_mid_flow_fails(client, csrf_headers, monkeypatch):
    user = _signup(client, csrf_headers, email="atomic@example.com")["user"]

    import app.api.v1.sessions as sessions_api

    def _raise_mid_flow(*args, **kwargs):
        raise RuntimeError("forced_mid_flow_error")

    monkeypatch.setattr(sessions_api, "apply_xp_gold", _raise_mid_flow)

    with pytest.raises(RuntimeError, match="forced_mid_flow_error"):
        client.post(
            "/api/v1/sessions",
            json={"subject": "SQL", "minutes": 15, "mode": "pomodoro"},
            headers=csrf_headers(),
        )

    with get_session() as db:
        sessions = db.exec(select(StudySession).where(StudySession.user_id == user["id"])).all()
        assert sessions == []

        audit_rows = db.exec(
            select(AuditEvent).where(
                AuditEvent.event == "session.created",
                AuditEvent.user_id == user["id"],
            )
        ).all()
        assert audit_rows == []
