from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session, select

from app.models import CombatBattle, User
from app.services.backend_first import (
    CommandError,
    idempotency_replay,
    save_idempotency_result,
)
from app.services.combat_content import CombatModule, get_combat_module
from app.services.inventory import use_inventory_item
from app.services.progression import apply_xp_gold, get_or_create_user_stats, progress_to_dict

PLAYER_MAX_HP = 100
WORLD_BOSS_HP = 9_999_999
PLAYER_BASE_PERCENT_MIN = 0.08
PLAYER_BASE_PERCENT_SPAN = 0.06
PLAYER_ROLL_MIN = 0.8
PLAYER_ROLL_MAX = 1.2
PLAYER_EFFECTIVE_PERCENT_MIN = 0.05
PLAYER_EFFECTIVE_PERCENT_MAX = 0.18

BOSS_DAMAGE_BY_RANK: dict[str, tuple[int, int]] = {
    "F": (4, 7),
    "D": (6, 9),
    "B": (8, 12),
    "A": (10, 14),
    "S": (12, 16),
    "E": (5, 8),
    "C": (7, 10),
}

VICTORY_REWARD_XP_BY_RANK = {
    "F": 80,
    "E": 100,
    "D": 130,
    "C": 170,
    "B": 220,
    "A": 280,
    "S": 360,
}
VICTORY_REWARD_GOLD_BY_RANK = {
    "F": 30,
    "E": 40,
    "D": 55,
    "C": 70,
    "B": 95,
    "A": 120,
    "S": 160,
}


def _clamp(value: float, min_value: float, max_value: float) -> float:
    return min(max_value, max(min_value, value))


def _random_int_inclusive(min_value: int, max_value: int) -> int:
    return random.randint(min_value, max_value)


def _shuffle(question_ids: list[str]) -> list[str]:
    deck = list(question_ids)
    random.shuffle(deck)
    return deck


def _question_bounds(module: CombatModule) -> tuple[int, int]:
    questions = module["questions"]
    if not questions:
        return 1, 1
    damages = [int(q["damage"]) for q in questions]
    return min(damages), max(damages)


def _question_by_id(module: CombatModule, question_id: str) -> dict[str, Any]:
    for question in module["questions"]:
        if question["id"] == question_id:
            return question
    raise CommandError(
        status_code=404,
        code="question_not_found",
        message="Question not found in module",
        details={"questionId": question_id},
    )


def _build_deck(module: CombatModule, previous_question_id: str | None) -> list[str]:
    question_ids = [q["id"] for q in module["questions"]]
    if not question_ids:
        return []
    deck = _shuffle(question_ids)
    if len(deck) > 1 and previous_question_id and deck[0] == previous_question_id:
        swap_idx = next((idx for idx, value in enumerate(deck) if value != previous_question_id), -1)
        if swap_idx > 0:
            deck[0], deck[swap_idx] = deck[swap_idx], deck[0]
    return deck


def _compute_player_damage(question_damage: int, boss_max_hp: int, bounds: tuple[int, int]) -> int:
    min_damage, max_damage = bounds
    spread = max(1, max_damage - min_damage)
    normalized = _clamp((question_damage - min_damage) / spread, 0.0, 1.0)
    base_percent = PLAYER_BASE_PERCENT_MIN + normalized * PLAYER_BASE_PERCENT_SPAN
    roll = random.uniform(PLAYER_ROLL_MIN, PLAYER_ROLL_MAX)
    effective_percent = _clamp(
        base_percent * roll,
        PLAYER_EFFECTIVE_PERCENT_MIN,
        PLAYER_EFFECTIVE_PERCENT_MAX,
    )
    return max(1, round(boss_max_hp * effective_percent))


def _roll_boss_damage(rank: str) -> int:
    min_damage, max_damage = BOSS_DAMAGE_BY_RANK.get(rank.strip().upper(), BOSS_DAMAGE_BY_RANK["D"])
    return _random_int_inclusive(min_damage, max_damage)


def _active_battle(session: Session, *, user_id: str, module_id: str) -> CombatBattle | None:
    return session.exec(
        select(CombatBattle).where(
            CombatBattle.user_id == user_id,
            CombatBattle.module_id == module_id,
            CombatBattle.status == "ongoing",
        )
    ).first()


def _battle_state_payload(battle: CombatBattle) -> dict[str, Any]:
    return {
        "battleId": battle.id,
        "playerHp": int(battle.player_hp),
        "playerMaxHp": int(battle.player_max_hp),
        "enemyHp": int(battle.enemy_hp),
        "enemyMaxHp": int(battle.enemy_max_hp),
        "turn": battle.turn_state,
        "status": battle.status,
    }


def _progress_payload(session: Session, user: User) -> dict[str, Any]:
    stats = get_or_create_user_stats(session, user, autocommit=False)
    return progress_to_dict(stats)


def start_battle(
    session: Session,
    *,
    user: User,
    module_id: str | None,
    reset: bool = False,
    idempotency_key: str,
) -> dict[str, Any]:
    command_type = "combat.start"
    replay = idempotency_replay(
        session,
        user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
    )
    if replay:
        return replay

    module = get_combat_module(module_id)
    battle = None if reset else _active_battle(session, user_id=user.id, module_id=module["id"])
    if battle is None:
        battle = CombatBattle(
            user_id=user.id,
            module_id=module["id"],
            status="ongoing",
            turn_state="PLAYER_IDLE",
            player_hp=PLAYER_MAX_HP,
            player_max_hp=PLAYER_MAX_HP,
            enemy_hp=WORLD_BOSS_HP,
            enemy_max_hp=WORLD_BOSS_HP,
            enemy_rank=str(module["boss"]["rank"]).upper(),
            current_question_id=None,
            last_question_id=None,
            deck_json=_build_deck(module, None),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        session.add(battle)
        session.flush()

    result_payload = {
        "moduleId": module["id"],
        "boss": {
            "name": module["boss"]["name"],
            "rank": module["boss"]["rank"],
            "hp": WORLD_BOSS_HP,
        },
        "battleState": _battle_state_payload(battle),
        "question": None,
        "progress": _progress_payload(session, user),
    }
    return save_idempotency_result(
        session,
        user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
        response_json=result_payload,
        status_code=200,
    )


def draw_question(
    session: Session,
    *,
    user: User,
    battle_id: str,
    idempotency_key: str,
) -> dict[str, Any]:
    command_type = "combat.question"
    replay = idempotency_replay(
        session,
        user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
    )
    if replay:
        return replay

    battle = session.exec(
        select(CombatBattle).where(CombatBattle.id == battle_id, CombatBattle.user_id == user.id)
    ).first()
    if not battle:
        raise CommandError(status_code=404, code="battle_not_found", message="Battle not found")

    if battle.status != "ongoing":
        raise CommandError(
            status_code=409,
            code="invalid_turn_state",
            message="Battle is already finished",
            details={"status": battle.status},
        )
    if battle.turn_state != "PLAYER_IDLE":
        raise CommandError(
            status_code=409,
            code="invalid_turn_state",
            message="It is not possible to draw a question right now",
            details={"turn": battle.turn_state},
        )

    module = get_combat_module(battle.module_id)
    if not module["questions"]:
        raise CommandError(
            status_code=409,
            code="module_without_questions",
            message="This module has no configured questions",
        )

    deck = list(battle.deck_json or [])
    if not deck:
        deck = _build_deck(module, battle.last_question_id)

    question_id = deck.pop(0)
    question = _question_by_id(module, question_id)
    battle.current_question_id = question_id
    battle.last_question_id = question_id
    battle.deck_json = deck
    battle.turn_state = "PLAYER_QUIZ"
    battle.updated_at = datetime.now(timezone.utc)
    session.add(battle)

    result_payload = {
        "battleState": _battle_state_payload(battle),
        "question": {
            "id": question["id"],
            "text": question["text"],
            "options": list(question["options"]),
        },
    }
    return save_idempotency_result(
        session,
        user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
        response_json=result_payload,
        status_code=200,
    )


def answer_question(
    session: Session,
    *,
    user: User,
    battle_id: str,
    question_id: str,
    option_index: int,
    idempotency_key: str,
) -> dict[str, Any]:
    command_type = "combat.answer"
    replay = idempotency_replay(
        session,
        user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
    )
    if replay:
        return replay

    battle = session.exec(
        select(CombatBattle).where(CombatBattle.id == battle_id, CombatBattle.user_id == user.id)
    ).first()
    if not battle:
        raise CommandError(status_code=404, code="battle_not_found", message="Battle not found")
    if battle.status != "ongoing":
        raise CommandError(
            status_code=409,
            code="invalid_turn_state",
            message="Battle already finished",
            details={"status": battle.status},
        )
    if battle.turn_state != "PLAYER_QUIZ":
        raise CommandError(
            status_code=409,
            code="invalid_turn_state",
            message="Question is not active",
            details={"turn": battle.turn_state},
        )
    if battle.current_question_id != question_id:
        raise CommandError(
            status_code=409,
            code="question_mismatch",
            message="Answered question does not match active question",
            details={"expectedQuestionId": battle.current_question_id, "questionId": question_id},
        )

    module = get_combat_module(battle.module_id)
    question = _question_by_id(module, question_id)
    is_correct = int(option_index) == int(question["correctAnswer"])

    player_damage = 0
    if is_correct:
        player_damage = _compute_player_damage(
            question_damage=int(question["damage"]),
            boss_max_hp=int(battle.enemy_max_hp),
            bounds=_question_bounds(module),
        )

    battle.enemy_hp = max(0, int(battle.enemy_hp) - int(player_damage))
    enemy_damage = 0
    result = "correct" if is_correct else "incorrect"

    if int(battle.enemy_hp) <= 0:
        battle.status = "victory"
        battle.turn_state = "VICTORY"
        battle.current_question_id = None
        damage_dealt = WORLD_BOSS_HP - int(battle.enemy_hp)
        reward_xp = max(0, damage_dealt // 5)
        reward_gold = max(0, damage_dealt // 20)
        apply_xp_gold(
            session,
            user,
            xp_delta=reward_xp,
            gold_delta=reward_gold,
            autocommit=False,
            persist_ledger=True,
            event_type="combat.victory",
            source_type="combat_battle",
            source_ref=battle.id,
            payload_json={"battleId": battle.id, "moduleId": battle.module_id, "bossRank": str(battle.enemy_rank)},
        )
    else:
        enemy_damage = _roll_boss_damage(str(battle.enemy_rank))
        battle.player_hp = max(0, int(battle.player_hp) - enemy_damage)
        battle.current_question_id = None
        if int(battle.player_hp) <= 0:
            battle.status = "defeat"
            battle.turn_state = "DEFEAT"
            damage_dealt = WORLD_BOSS_HP - int(battle.enemy_hp)
            reward_xp = max(0, (damage_dealt // 5) // 2)
            reward_gold = max(0, (damage_dealt // 20) // 2)
            apply_xp_gold(
                session,
                user,
                xp_delta=reward_xp,
                gold_delta=reward_gold,
                autocommit=False,
                persist_ledger=True,
                event_type="combat.defeat",
                source_type="combat_battle",
                source_ref=battle.id,
                payload_json={"battleId": battle.id, "moduleId": battle.module_id, "bossRank": str(battle.enemy_rank), "penalty": True},
            )
        else:
            battle.turn_state = "PLAYER_IDLE"

    battle.updated_at = datetime.now(timezone.utc)
    session.add(battle)

    result_payload = {
        "result": result,
        "playerDamage": int(player_damage),
        "enemyDamage": int(enemy_damage),
        "battleState": _battle_state_payload(battle),
        "progress": _progress_payload(session, user),
    }
    return save_idempotency_result(
        session,
        user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
        response_json=result_payload,
        status_code=200,
    )


def flee_battle(
    session: Session,
    *,
    user: User,
    battle_id: str,
    idempotency_key: str,
) -> dict[str, Any]:
    command_type = "combat.flee"
    replay = idempotency_replay(
        session,
        user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
    )
    if replay:
        return replay

    battle = session.exec(
        select(CombatBattle).where(CombatBattle.id == battle_id, CombatBattle.user_id == user.id)
    ).first()
    if not battle:
        raise CommandError(status_code=404, code="battle_not_found", message="Battle not found")
    if battle.status != "ongoing":
        raise CommandError(
            status_code=409,
            code="invalid_turn_state",
            message="Battle already finished",
            details={"status": battle.status},
        )

    damage_dealt = WORLD_BOSS_HP - int(battle.enemy_hp)
    reward_xp = max(0, damage_dealt // 5)
    reward_gold = max(0, damage_dealt // 20)

    battle.status = "victory"
    battle.turn_state = "VICTORY"
    battle.current_question_id = None
    
    apply_xp_gold(
        session,
        user,
        xp_delta=reward_xp,
        gold_delta=reward_gold,
        autocommit=False,
        persist_ledger=True,
        event_type="combat.flee",
        source_type="combat_battle",
        source_ref=battle.id,
        payload_json={"battleId": battle.id, "moduleId": battle.module_id, "bossRank": str(battle.enemy_rank), "extracted": True},
    )

    battle.updated_at = datetime.now(timezone.utc)
    session.add(battle)

    result_payload = {
        "xpReward": reward_xp,
        "goldReward": reward_gold,
        "totalDamageDealt": damage_dealt,
        "battleState": _battle_state_payload(battle),
        "progress": _progress_payload(session, user),
    }
    return save_idempotency_result(
        session,
        user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
        response_json=result_payload,
        status_code=200,
    )


def consume_item_in_battle(
    session: Session,
    *,
    user: User,
    battle_id: str,
    item_id: str,
    idempotency_key: str,
) -> dict[str, Any]:
    command_type = "combat.consume"
    replay = idempotency_replay(
        session,
        user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
    )
    if replay:
        return replay

    battle = session.exec(
        select(CombatBattle).where(CombatBattle.id == battle_id, CombatBattle.user_id == user.id)
    ).first()
    if not battle:
        raise CommandError(status_code=404, code="battle_not_found", message="Battle not found")
    if battle.status != "ongoing":
        raise CommandError(
            status_code=409,
            code="invalid_turn_state",
            message="Battle already finished or inactive",
            details={"status": battle.status},
        )
    if battle.turn_state not in ("PLAYER_IDLE", "PLAYER_QUIZ"):
        raise CommandError(
            status_code=409,
            code="invalid_turn_state",
            message="Cannot use item during enemy turn or attack phase",
        )

    # Consume directly from core inventory module
    inv_result = use_inventory_item(session, user, item_id=item_id, qty=1)
    
    # Calculate In-Game specific healing bonuses (Coffee gives +40 HP in combat)
    heal_amount = 0
    if item_id == "coffee" and inv_result["consumedQty"] > 0:
        heal_amount = 40
    
    battle.player_hp = min(int(battle.player_max_hp), int(battle.player_hp) + heal_amount)
    battle.updated_at = datetime.now(timezone.utc)
    session.add(battle)

    result_payload = {
        "healAmount": heal_amount,
        "battleState": _battle_state_payload(battle),
        "progress": _progress_payload(session, user),
    }

    return save_idempotency_result(
        session,
        user_id=user.id,
        command_type=command_type,
        idempotency_key=idempotency_key,
        response_json=result_payload,
        status_code=200,
    )
