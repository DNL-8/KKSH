def _signup(client, csrf_headers, email="history@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200


def test_system_history_requires_auth(client, csrf_headers):
    r_get = client.get("/api/v1/ai/system-history")
    assert r_get.status_code == 401

    r_post = client.post(
        "/api/v1/ai/system-history",
        json={"messages": [{"role": "user", "content": "oi"}]},
        headers=csrf_headers(),
    )
    assert r_post.status_code == 401

    r_delete = client.delete("/api/v1/ai/system-history", headers=csrf_headers())
    assert r_delete.status_code == 401


def test_system_history_append_list_and_clear(client, csrf_headers):
    _signup(client, csrf_headers, email="history-flow@example.com")

    empty = client.get("/api/v1/ai/system-history?limit=10")
    assert empty.status_code == 200
    assert empty.json()["messages"] == []

    append = client.post(
        "/api/v1/ai/system-history",
        json={
            "messages": [
                {"role": "user", "content": "Hunter, status de hoje?"},
                {
                    "role": "system",
                    "content": "[STATUS] Evolucao estavel.",
                    "source": "gemini",
                    "xpHint": 12,
                    "missionDoneHint": False,
                    "statusHint": "Sem penalidades.",
                },
            ]
        },
        headers=csrf_headers(),
    )
    assert append.status_code == 200
    payload = append.json()
    assert len(payload["messages"]) == 2
    assert payload["messages"][0]["role"] == "user"
    assert payload["messages"][1]["role"] == "system"
    assert payload["messages"][1]["xpHint"] == 12
    assert payload["messages"][1]["statusHint"] == "Sem penalidades."

    append_2 = client.post(
        "/api/v1/ai/system-history",
        json={
            "messages": [
                {"role": "user", "content": "Registrei 30 minutos de SQL."},
                {"role": "system", "content": "[RECOMPENSA] XP +10", "source": "fallback"},
            ]
        },
        headers=csrf_headers(),
    )
    assert append_2.status_code == 200

    listed = client.get("/api/v1/ai/system-history?limit=3")
    assert listed.status_code == 200
    listed_payload = listed.json()
    assert len(listed_payload["messages"]) == 3
    assert listed_payload["messages"][0]["content"] == "[STATUS] Evolucao estavel."
    assert listed_payload["messages"][2]["content"] == "[RECOMPENSA] XP +10"

    cleared = client.delete("/api/v1/ai/system-history", headers=csrf_headers())
    assert cleared.status_code == 204

    after = client.get("/api/v1/ai/system-history?limit=10")
    assert after.status_code == 200
    assert after.json()["messages"] == []
