import pytest
from sqlmodel import select

from app.db import get_session
from app.models import AuditEvent, StudySession, XpLedgerEvent


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


def test_video_lesson_completion_is_deduped_by_notes_ref(client, csrf_headers):
    user = _signup(client, csrf_headers, email="video-dedupe@example.com")["user"]
    base_payload = {
        "subject": "Python",
        "minutes": 12,
        "mode": "video_lesson",
        "notes": "video_completion::v2:sha256:ref-abc",
    }

    first = client.post("/api/v1/sessions", json=base_payload, headers=csrf_headers())
    assert first.status_code == 201
    assert first.json()["xpEarned"] > 0

    duplicate = client.post("/api/v1/sessions", json=base_payload, headers=csrf_headers())
    assert duplicate.status_code == 200
    assert duplicate.json() == {"ok": True, "xpEarned": 0, "goldEarned": 0}

    state = client.get("/api/v1/me/state")
    assert state.status_code == 200
    assert state.json()["todayMinutes"] == 12

    with get_session() as db:
        sessions = db.exec(
            select(StudySession).where(
                StudySession.user_id == user["id"],
                StudySession.mode == "video_lesson",
                StudySession.notes == base_payload["notes"],
                StudySession.deleted_at.is_(None),
            )
        ).all()
        assert len(sessions) == 1

        ledger_rows = db.exec(
            select(XpLedgerEvent).where(
                XpLedgerEvent.user_id == user["id"],
                XpLedgerEvent.source_type == "video_lesson_completion",
                XpLedgerEvent.source_ref == "v2:sha256:ref-abc",
            )
        ).all()
        assert len(ledger_rows) == 1

    other_ref = {
        **base_payload,
        "notes": "video_completion::v2:sha256:ref-def",
    }
    other = client.post("/api/v1/sessions", json=other_ref, headers=csrf_headers())
    assert other.status_code == 201

    state_after_other = client.get("/api/v1/me/state")
    assert state_after_other.status_code == 200
    assert state_after_other.json()["todayMinutes"] == 24


def test_video_session_applies_vitals_costs(client, csrf_headers):
    user = _signup(client, csrf_headers, email="video-vitals@example.com")["user"]

    created = client.post(
        "/api/v1/sessions",
        json={"subject": "Python", "minutes": 45, "mode": "video_lesson"},
        headers=csrf_headers(),
    )
    assert created.status_code == 201
    assert created.json()["xpEarned"] > 0

    progress = client.get("/api/v1/progress")
    assert progress.status_code == 200
    vitals = progress.json()["vitals"]
    assert vitals["hp"] == 98
    assert vitals["mana"] == 90
    assert vitals["fatigue"] == 26

    with get_session() as db:
        row = db.exec(
            select(StudySession).where(
                StudySession.user_id == user["id"],
                StudySession.mode == "video_lesson",
                StudySession.deleted_at.is_(None),
            )
        ).first()
        assert row is not None
        assert int(row.hp_delta) == -2
        assert int(row.mana_delta) == -10
        assert int(row.fatigue_delta) == 6


def test_session_update_and_delete_rollback_vitals(client, csrf_headers):
    _signup(client, csrf_headers, email="session-vitals-rollback@example.com")

    created = client.post(
        "/api/v1/sessions",
        json={"subject": "Treino", "minutes": 30, "mode": "workout"},
        headers=csrf_headers(),
    )
    assert created.status_code == 201

    listed = client.get("/api/v1/sessions?limit=1")
    assert listed.status_code == 200
    session_id = listed.json()["sessions"][0]["id"]

    progress_after_create = client.get("/api/v1/progress").json()
    assert progress_after_create["vitals"]["hp"] == 90
    assert progress_after_create["vitals"]["mana"] == 97
    assert progress_after_create["vitals"]["fatigue"] == 32

    updated = client.patch(
        f"/api/v1/sessions/{session_id}",
        json={"minutes": 15},
        headers=csrf_headers(),
    )
    assert updated.status_code == 204

    progress_after_update = client.get("/api/v1/progress").json()
    assert progress_after_update["vitals"]["hp"] == 94
    assert progress_after_update["vitals"]["mana"] == 98
    assert progress_after_update["vitals"]["fatigue"] == 26

    deleted = client.delete(
        f"/api/v1/sessions/{session_id}",
        headers=csrf_headers(),
    )
    assert deleted.status_code == 204

    progress_after_delete = client.get("/api/v1/progress").json()
    assert progress_after_delete["vitals"]["hp"] == 100
    assert progress_after_delete["vitals"]["mana"] == 100
    assert progress_after_delete["vitals"]["fatigue"] == 20


def test_session_exhaustion_penalty_reduces_rewards(client, csrf_headers):
    user = _signup(client, csrf_headers, email="session-exhaustion@example.com")["user"]

    created = client.post(
        "/api/v1/sessions",
        json={"subject": "Deep Study", "minutes": 500, "mode": "pomodoro"},
        headers=csrf_headers(),
    )
    assert created.status_code == 201
    body = created.json()
    assert body["xpEarned"] == 875
    assert body["goldEarned"] == 175

    progress = client.get("/api/v1/progress").json()
    assert progress["vitals"]["hp"] == 75
    assert progress["vitals"]["mana"] == 0
    assert progress["vitals"]["fatigue"] == 100

    with get_session() as db:
        row = db.exec(
            select(StudySession).where(
                StudySession.user_id == user["id"],
                StudySession.subject == "Deep Study",
                StudySession.deleted_at.is_(None),
            )
        ).first()
        assert row is not None
        assert int(row.reward_multiplier_bps) == 3500
