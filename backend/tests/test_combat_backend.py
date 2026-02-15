def _signup(client, csrf_headers, email="combat-backend@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200


def _headers(csrf_headers, idem: str | None = None):
    headers = csrf_headers()
    if idem:
        headers["Idempotency-Key"] = idem
    return headers


def _question_answer(question_text: str) -> int:
    text = question_text.lower()
    if "atalho" in text and "coluna" in text:
        return 0
    if "simbolo" in text and "excel" in text:
        return 2
    if "referencia absoluta" in text:
        return 1
    if "linguagem" in text and "power query" in text:
        return 2
    if "unpivot" in text:
        return 1
    if "ferramenta de" in text:
        return 1
    raise AssertionError(f"Pergunta nao reconhecida: {question_text}")


def test_combat_answer_correct_is_idempotent(client, csrf_headers):
    _signup(client, csrf_headers, email="combat-correct@example.com")

    start = client.post(
        "/api/v1/combat/start",
        json={"moduleId": "basic", "reset": True},
        headers=_headers(csrf_headers, "combat-start-correct-1"),
    )
    assert start.status_code == 200
    battle = start.json()["battleState"]
    battle_id = battle["battleId"]

    q = client.post(
        "/api/v1/combat/question",
        json={"battleId": battle_id},
        headers=_headers(csrf_headers, "combat-question-correct-1"),
    )
    assert q.status_code == 200
    question = q.json()["question"]
    correct_index = _question_answer(question["text"])

    idem = "combat-answer-idem-1"
    answer1 = client.post(
        "/api/v1/combat/answer",
        json={"battleId": battle_id, "questionId": question["id"], "optionIndex": correct_index},
        headers=_headers(csrf_headers, idem),
    )
    assert answer1.status_code == 200
    body1 = answer1.json()
    assert body1["result"] == "correct"
    assert int(body1["playerDamage"]) > 0
    assert int(body1["battleState"]["enemyHp"]) < int(body1["battleState"]["enemyMaxHp"])

    answer2 = client.post(
        "/api/v1/combat/answer",
        json={"battleId": battle_id, "questionId": question["id"], "optionIndex": correct_index},
        headers=_headers(csrf_headers, idem),
    )
    assert answer2.status_code == 200
    assert answer2.json() == body1


def test_combat_start_is_idempotent_with_same_key(client, csrf_headers):
    _signup(client, csrf_headers, email="combat-start-idem@example.com")

    idem = "combat-start-idem-1"
    start1 = client.post(
        "/api/v1/combat/start",
        json={"moduleId": "basic", "reset": True},
        headers=_headers(csrf_headers, idem),
    )
    assert start1.status_code == 200
    body1 = start1.json()

    start2 = client.post(
        "/api/v1/combat/start",
        json={"moduleId": "basic", "reset": True},
        headers=_headers(csrf_headers, idem),
    )
    assert start2.status_code == 200
    assert start2.json() == body1


def test_combat_question_is_idempotent_with_same_key(client, csrf_headers):
    _signup(client, csrf_headers, email="combat-question-idem@example.com")

    start = client.post(
        "/api/v1/combat/start",
        json={"moduleId": "basic", "reset": True},
        headers=_headers(csrf_headers, "combat-start-question-idem-1"),
    )
    assert start.status_code == 200
    battle_id = start.json()["battleState"]["battleId"]

    idem_q = "combat-question-idem-1"
    q1 = client.post(
        "/api/v1/combat/question",
        json={"battleId": battle_id},
        headers=_headers(csrf_headers, idem_q),
    )
    assert q1.status_code == 200
    body1 = q1.json()

    q2 = client.post(
        "/api/v1/combat/question",
        json={"battleId": battle_id},
        headers=_headers(csrf_headers, idem_q),
    )
    assert q2.status_code == 200
    assert q2.json() == body1


def test_combat_wrong_answer_does_not_damage_enemy(client, csrf_headers):
    _signup(client, csrf_headers, email="combat-wrong@example.com")

    start = client.post(
        "/api/v1/combat/start",
        json={"moduleId": "powerquery", "reset": True},
        headers=_headers(csrf_headers, "combat-start-wrong-1"),
    )
    assert start.status_code == 200
    battle = start.json()["battleState"]
    battle_id = battle["battleId"]
    enemy_hp_before = int(battle["enemyHp"])
    player_hp_before = int(battle["playerHp"])

    q = client.post(
        "/api/v1/combat/question",
        json={"battleId": battle_id},
        headers=_headers(csrf_headers, "combat-question-wrong-1"),
    )
    assert q.status_code == 200
    question = q.json()["question"]
    correct_index = _question_answer(question["text"])
    wrong_index = (correct_index + 1) % 4

    answer = client.post(
        "/api/v1/combat/answer",
        json={"battleId": battle_id, "questionId": question["id"], "optionIndex": wrong_index},
        headers=_headers(csrf_headers, "combat-answer-idem-2"),
    )
    assert answer.status_code == 200
    body = answer.json()
    assert body["result"] == "incorrect"
    assert int(body["playerDamage"]) == 0
    assert int(body["battleState"]["enemyHp"]) == enemy_hp_before
    assert int(body["battleState"]["playerHp"]) < player_hp_before


def test_combat_answer_requires_idempotency_key(client, csrf_headers):
    _signup(client, csrf_headers, email="combat-idem-required@example.com")

    start_missing = client.post(
        "/api/v1/combat/start",
        json={"moduleId": "basic", "reset": True},
        headers=_headers(csrf_headers),
    )
    assert start_missing.status_code == 422
    assert start_missing.json()["code"] == "idempotency_key_required"

    start = client.post(
        "/api/v1/combat/start",
        json={"moduleId": "basic", "reset": True},
        headers=_headers(csrf_headers, "combat-start-idem-required-1"),
    )
    assert start.status_code == 200
    battle_id = start.json()["battleState"]["battleId"]

    question_missing = client.post(
        "/api/v1/combat/question",
        json={"battleId": battle_id},
        headers=_headers(csrf_headers),
    )
    assert question_missing.status_code == 422
    assert question_missing.json()["code"] == "idempotency_key_required"

    q = client.post(
        "/api/v1/combat/question",
        json={"battleId": battle_id},
        headers=_headers(csrf_headers, "combat-question-idem-required-1"),
    )
    assert q.status_code == 200
    question = q.json()["question"]
    correct_index = _question_answer(question["text"])

    answer = client.post(
        "/api/v1/combat/answer",
        json={"battleId": battle_id, "questionId": question["id"], "optionIndex": correct_index},
        headers=_headers(csrf_headers),
    )
    assert answer.status_code == 422
    assert answer.json()["code"] == "idempotency_key_required"
