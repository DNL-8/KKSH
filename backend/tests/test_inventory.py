def _signup(client, csrf_headers, email="inventory@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200
    return r.json()


def _find_item(rows, item_id: str):
    return next((x for x in rows if x["id"] == item_id), None)


def test_inventory_persists_and_consumes(client, csrf_headers):
    _signup(client, csrf_headers)

    state = client.get("/api/v1/me/state").json()
    assert "inventory" in state
    assert state["inventory"], "expected default inventory rows"
    assert "vitals" in state
    assert state["vitals"]["hp"] == 100
    assert state["vitals"]["fatigue"] == 20

    coffee = _find_item(state["inventory"], "coffee")
    keyboard = _find_item(state["inventory"], "keyboard")
    debug_eye = _find_item(state["inventory"], "debug_eye")

    assert coffee is not None
    assert keyboard is not None
    assert debug_eye is not None
    assert coffee["qty"] == 5
    assert keyboard["qty"] == 1
    assert debug_eye["qty"] == 0

    r = client.post(
        "/api/v1/inventory/use",
        json={"itemId": "coffee", "qty": 1},
        headers=csrf_headers(),
    )
    assert r.status_code == 200
    body = r.json()
    assert body["consumedQty"] == 1
    assert body["item"]["id"] == "coffee"
    assert body["item"]["qty"] == 4
    assert body["vitals"]["hp"] == 100
    assert body["vitals"]["fatigue"] == 0

    state2 = client.get("/api/v1/me/state").json()
    coffee2 = _find_item(state2["inventory"], "coffee")
    assert coffee2["qty"] == 4
    assert state2["vitals"]["fatigue"] == 0

    # passive item is valid but not consumed
    r = client.post(
        "/api/v1/inventory/use",
        json={"itemId": "keyboard", "qty": 1},
        headers=csrf_headers(),
    )
    assert r.status_code == 200
    assert r.json()["consumedQty"] == 0
    assert r.json()["item"]["qty"] == 1

    # passive locked item remains unchanged
    r = client.post(
        "/api/v1/inventory/use",
        json={"itemId": "debug_eye", "qty": 1},
        headers=csrf_headers(),
    )
    assert r.status_code == 200
    assert r.json()["consumedQty"] == 0

    r = client.post(
        "/api/v1/inventory/use",
        json={"itemId": "unknown_item", "qty": 1},
        headers=csrf_headers(),
    )
    assert r.status_code == 404
