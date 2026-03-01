from sqlmodel import select

from app.db import get_session
from app.models import SystemRPGStats


def _signup(client, csrf_headers, email="system-rpg@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200
    return r.json()["user"]["id"]


def test_system_rpg_level_updates_when_xp_changes(client, csrf_headers):
    _signup(client, csrf_headers, email="system-rpg-xp@example.com")

    patched = client.patch(
        "/api/v1/system-rpg",
        json={"xp": 900},
        headers=csrf_headers(),
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["xp"] == 900
    assert body["level"] == 2


def test_system_rpg_get_reconciles_stale_level(client, csrf_headers):
    user_id = _signup(client, csrf_headers, email="system-rpg-reconcile@example.com")

    with get_session() as db:
        stats = db.exec(select(SystemRPGStats).where(SystemRPGStats.user_id == user_id)).first()
        if not stats:
            stats = SystemRPGStats(user_id=user_id)
        stats.xp = 6000
        stats.level = 1
        db.add(stats)
        db.commit()

    fetched = client.get("/api/v1/system-rpg")
    assert fetched.status_code == 200
    body = fetched.json()
    assert body["xp"] == 6000
    assert body["level"] == 4
