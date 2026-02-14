def _signup(client, csrf_headers, email="dynamic-claim@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200


def _complete_quest_via_session(client, csrf_headers, subject: str, remaining: int):
    if remaining <= 0:
        return
    r = client.post(
        "/api/v1/sessions",
        json={"subject": subject, "minutes": remaining, "mode": "pomodoro"},
        headers=csrf_headers(),
    )
    assert r.status_code == 201


def test_daily_and_weekly_claim_use_dynamic_rewards(client, csrf_headers):
    _signup(client, csrf_headers)

    state = client.get("/api/v1/me/state").json()
    daily = state["dailyQuests"][0]
    weekly = state["weeklyQuests"][0]

    daily_remaining = max(0, int(daily["targetMinutes"]) - int(daily["progressMinutes"]))
    _complete_quest_via_session(client, csrf_headers, daily["subject"], daily_remaining)

    state_mid = client.get("/api/v1/me/state").json()
    daily_mid = next(q for q in state_mid["dailyQuests"] if q["id"] == daily["id"])
    reward_daily_gold = int(daily_mid.get("rewardGold") or 25)
    gold_before_daily = int(state_mid["progression"]["gold"])

    r = client.post(f"/api/v1/daily-quests/{daily['id']}/claim", headers=csrf_headers())
    assert r.status_code == 204

    state_after_daily = client.get("/api/v1/me/state").json()
    gold_after_daily = int(state_after_daily["progression"]["gold"])
    assert gold_after_daily - gold_before_daily == reward_daily_gold

    weekly_after_daily = next(
        q for q in state_after_daily["weeklyQuests"] if q["id"] == weekly["id"]
    )
    weekly_remaining = max(
        0, int(weekly_after_daily["targetMinutes"]) - int(weekly_after_daily["progressMinutes"])
    )
    _complete_quest_via_session(
        client, csrf_headers, weekly_after_daily["subject"], weekly_remaining
    )

    state_before_weekly_claim = client.get("/api/v1/me/state").json()
    weekly_ready = next(
        q for q in state_before_weekly_claim["weeklyQuests"] if q["id"] == weekly["id"]
    )
    reward_weekly_gold = int(weekly_ready.get("rewardGold") or 100)
    gold_before_weekly = int(state_before_weekly_claim["progression"]["gold"])

    r = client.post(f"/api/v1/weekly-quests/{weekly['id']}/claim", headers=csrf_headers())
    assert r.status_code == 204

    state_after_weekly = client.get("/api/v1/me/state").json()
    gold_after_weekly = int(state_after_weekly["progression"]["gold"])
    assert gold_after_weekly - gold_before_weekly == reward_weekly_gold
