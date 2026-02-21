from __future__ import annotations

import json
import re
import unicodedata
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError
from sqlmodel import Session, select

from app.core.config import settings
from app.models import DailyQuest, User, UserSettings, WeeklyQuest
from app.services.gemini_client import (
    GeminiError,
    extract_json_block,
    generate_content_text,
    get_api_key,
)

Cycle = Literal["daily", "weekly"]
GenerationSource = Literal["gemini", "fallback", "mixed"]


_RANKS = ["F", "E", "D", "C", "B", "A", "S"]
_DIFFICULTIES = {"easy", "medium", "hard", "elite"}

_SUBJECT_FALLBACK_POOL = [
    "SQL",
    "Python",
    "Excel",
    "Data Modeling",
    "Cloud",
    "ETL",
    "Spark",
    "Kafka",
    "dbt",
    "Airflow",
    "General",
]

_ALIAS_BUCKETS: dict[str, set[str]] = {
    "sql": {"sql", "postgres", "mysql", "query", "queries", "analytics engineering"},
    "python": {"python", "pandas", "polars", "py"},
    "etl": {"etl", "elt", "pipeline", "orquestracao", "airflow", "dag", "ingestao", "ingestion"},
    "modeling": {"modelagem", "modeling", "dbt", "warehouse", "data modeling"},
    "cloud": {"cloud", "aws", "gcp", "azure", "lakehouse"},
    "stream": {"stream", "streaming", "kafka", "flink"},
    "excel": {"excel", "spreadsheet", "planilha"},
}


class _GeneratedMissionIn(BaseModel):
    subject: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=280)
    targetMinutes: int = Field(ge=5, le=1800)
    rank: str = Field(min_length=1, max_length=3)
    difficulty: str = Field(min_length=1, max_length=16)
    objective: str = Field(min_length=1, max_length=180)
    tags: list[str] = Field(default_factory=list, max_length=8)


class _GeneratedPayloadIn(BaseModel):
    daily: list[_GeneratedMissionIn] = Field(default_factory=list)
    weekly: list[_GeneratedMissionIn] = Field(default_factory=list)


@dataclass(slots=True)
class MissionSpec:
    subject: str
    title: str
    description: str
    target_minutes: int
    rank: str
    difficulty: str
    objective: str
    tags: list[str]
    reward_xp: int
    reward_gold: int
    source: str


@dataclass(slots=True)
class MissionGenerationOutput:
    source: GenerationSource
    warnings: list[str]
    daily: list[MissionSpec]
    weekly: list[MissionSpec]


def _normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _display_subject(value: str) -> str:
    normalized = " ".join(str(value or "").strip().split())
    if not normalized:
        return "General"
    lower = normalized.lower()
    if lower in {"sql", "etl", "elt", "dbt", "api"}:
        return lower.upper()
    if lower in {"py", "python"}:
        return "Python"
    words = [w.capitalize() if len(w) > 2 else w.upper() for w in normalized.split(" ")]
    return " ".join(words)


def _subject_bucket(subject: str) -> str:
    normalized = _normalize_text(subject)
    for bucket, aliases in _ALIAS_BUCKETS.items():
        for alias in aliases:
            if alias in normalized:
                return bucket
    return normalized or "general"


def _rank_index(rank: str) -> int:
    try:
        return _RANKS.index(rank.upper())
    except ValueError:
        return 0


def _normalize_rank(value: str, *, fallback: str = "F") -> str:
    rank = str(value or "").strip().upper()
    if rank in _RANKS:
        return rank
    if rank.startswith("R-") and rank[2:] in _RANKS:
        return rank[2:]
    return fallback


def _normalize_difficulty(value: str, *, rank: str) -> str:
    normalized = _normalize_text(value)
    if normalized in _DIFFICULTIES:
        return normalized
    idx = _rank_index(rank)
    if idx <= 1:
        return "easy"
    if idx <= 3:
        return "medium"
    if idx <= 5:
        return "hard"
    return "elite"


def _reward_for(*, rank: str, difficulty: str, cycle: Cycle) -> tuple[int, int]:
    idx = _rank_index(rank) + 1
    difficulty_factor = {
        "easy": 0.95,
        "medium": 1.10,
        "hard": 1.35,
        "elite": 1.60,
    }.get(difficulty, 1.0)

    if cycle == "daily":
        base_xp = 30 + idx * 24
        base_gold = 12 + idx * 9
    else:
        base_xp = 120 + idx * 65
        base_gold = 50 + idx * 30

    xp = max(10, int(round(base_xp * difficulty_factor)))
    gold = max(5, int(round(base_gold * difficulty_factor)))
    return xp, gold


def _goal_subjects(goals: dict[str, int], *, count: int) -> list[str]:
    positive = [(k, int(v or 0)) for k, v in goals.items() if int(v or 0) > 0]
    positive.sort(key=lambda item: item[1], reverse=True)

    picked: list[str] = []
    seen: set[str] = set()

    for subject, _ in positive:
        display = _display_subject(subject)
        key = _normalize_text(display)
        if not key or key in seen:
            continue
        picked.append(display)
        seen.add(key)
        if len(picked) >= count:
            return picked

    for subject in _SUBJECT_FALLBACK_POOL:
        display = _display_subject(subject)
        key = _normalize_text(display)
        if key in seen:
            continue
        picked.append(display)
        seen.add(key)
        if len(picked) >= count:
            return picked

    return picked[:count]


def build_fallback_missions(
    *, goals: dict[str, int], cycle: Cycle, count: int = 5
) -> list[MissionSpec]:
    subjects = _goal_subjects(goals, count=count)
    rows: list[MissionSpec] = []

    for idx, subject in enumerate(subjects):
        goal_value = int(goals.get(subject, goals.get(subject.upper(), 0)) or 0)
        if cycle == "daily":
            target = max(10, min(180, (goal_value or 25) + idx * 5))
            rank = _RANKS[min(idx, len(_RANKS) - 1)]
            difficulty = _normalize_difficulty("", rank=rank)
            title = f"[{rank}] Protocolo Diario - {subject}"
            description = (
                f"Ciclo focado em {subject} para consolidar consistencia e entrega diaria."
            )
            objective = f"Registrar e concluir {target} minutos em {subject} hoje."
        else:
            daily_goal = goal_value or 25
            target = max(60, min(1200, daily_goal * 7 + idx * 20))
            rank = _RANKS[min(idx + 1, len(_RANKS) - 1)]
            difficulty = _normalize_difficulty("", rank=rank)
            title = f"[{rank}] Campanha Semanal - {subject}"
            description = (
                f"Missao semanal para elevar dominio de {subject} com volume e repeticao orientada."
            )
            objective = f"Acumular {target} minutos em {subject} nesta semana operacional."

        reward_xp, reward_gold = _reward_for(rank=rank, difficulty=difficulty, cycle=cycle)
        rows.append(
            MissionSpec(
                subject=subject,
                title=title,
                description=description,
                target_minutes=target,
                rank=rank,
                difficulty=difficulty,
                objective=objective,
                tags=[_normalize_text(subject).replace(" ", "-"), cycle, difficulty],
                reward_xp=reward_xp,
                reward_gold=reward_gold,
                source="fallback",
            )
        )

    return rows


def _resolve_user_api_key(user_settings: UserSettings | None) -> str:
    """Resolve API key from user settings, falling back to system key."""
    if user_settings and user_settings.gemini_api_key:
        from app.core.secrets import decrypt_secret
        raw = (decrypt_secret(user_settings.gemini_api_key) or "").strip()
        if raw:
            return get_api_key(user_gemini_key=raw)
    return get_api_key()


async def _try_generate_with_gemini(
    *,
    goals: dict[str, int],
    cycle: Literal["daily", "weekly", "both"],
    user_settings: UserSettings | None = None,
) -> _GeneratedPayloadIn | None:
    api_key = _resolve_user_api_key(user_settings)
    if not api_key:
        return None

    # Personality injection
    personality = (user_settings.agent_personality if user_settings else "standard") or "standard"
    personality_prompt = ""
    if personality == "hardcore":
        personality_prompt = "Atue como um Sargento Instrutor militar. Seja rigido, use girias militares e exija disciplina maxima."
    elif personality == "zen":
        personality_prompt = "Atue como um Mentor Zen. Seja calmo, filosofico e foque no equilibrio e consistencia."
    elif personality == "gamer":
        personality_prompt = "Atue como um Gamemaster RPG. Use termos de jogos (buff, nerf, grind), seja empolgado e trate o estudo como XP."
    else:
        personality_prompt = "Voce e um gerador de missoes oficiais para um app RPG de estudos."

    goals_payload = {k: int(v or 0) for k, v in goals.items()}
    prompt = (
        f"{personality_prompt} "
        "Responda APENAS JSON valido no formato: "
        '{"daily":[{subject,title,description,targetMinutes,rank,difficulty,objective,tags}],'
        '"weekly":[{subject,title,description,targetMinutes,rank,difficulty,objective,tags}]}. '
        "Sempre produza 5 itens em cada lista solicitada, sem repetir subject no mesmo ciclo. "
        "Use PT-BR conciso, rank em F/E/D/C/B/A/S e difficulty em easy|medium|hard|elite. "
        f"Ciclo solicitado: {cycle}. "
        f"Metas por assunto: {json.dumps(goals_payload, ensure_ascii=False)}"
    )

    try:
        text = await generate_content_text(
            prompt=prompt,
            system_instruction="Voce atua como Sistema. Entregue JSON limpo, sem markdown, sem comentarios, sem texto extra.",
            response_mime_type="application/json",
            api_key=api_key,
        )
    except GeminiError:
        return None

    if not text:
        return None

    try:
        payload = json.loads(extract_json_block(text))
    except json.JSONDecodeError:
        return None

    if not isinstance(payload, dict):
        return None

    try:
        return _GeneratedPayloadIn.model_validate(payload)
    except ValidationError:
        return None


def _sanitize_tags(tags: list[str]) -> list[str]:
    clean: list[str] = []
    seen: set[str] = set()
    for tag in tags:
        normalized = _normalize_text(tag).replace(" ", "-")
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        clean.append(normalized[:32])
        if len(clean) >= 6:
            break
    return clean


def _sanitize_generated_row(
    row: _GeneratedMissionIn, *, cycle: Cycle, goals: dict[str, int], source: str
) -> MissionSpec:
    subject = _display_subject(row.subject)
    rank = _normalize_rank(row.rank)
    difficulty = _normalize_difficulty(row.difficulty, rank=rank)

    if cycle == "daily":
        default_target = max(10, int(goals.get(subject, 25) or 25))
        target = max(10, min(180, int(row.targetMinutes or default_target)))
    else:
        base_daily = max(10, int(goals.get(subject, 25) or 25))
        default_target = max(60, base_daily * 7)
        target = max(60, min(1200, int(row.targetMinutes or default_target)))

    reward_xp, reward_gold = _reward_for(rank=rank, difficulty=difficulty, cycle=cycle)
    title = str(row.title).strip()[:120] or f"[{rank}] Missao {subject}"
    description = str(row.description).strip()[:280] or f"Execucao de {subject}."
    objective = str(row.objective).strip()[:180] or f"Concluir {target} minutos em {subject}."

    tags = _sanitize_tags(row.tags)
    if not tags:
        tags = [_normalize_text(subject).replace(" ", "-"), cycle, difficulty]

    return MissionSpec(
        subject=subject,
        title=title,
        description=description,
        target_minutes=target,
        rank=rank,
        difficulty=difficulty,
        objective=objective,
        tags=tags,
        reward_xp=reward_xp,
        reward_gold=reward_gold,
        source=source,
    )


def _ensure_unique_and_complete(
    *,
    rows: list[MissionSpec],
    fallback_rows: list[MissionSpec],
    count: int,
    warnings: list[str],
    source_from_model: bool,
) -> list[MissionSpec]:
    unique: list[MissionSpec] = []
    seen: set[str] = set()

    for row in rows:
        key = _normalize_text(row.subject)
        if not key or key in seen:
            continue
        seen.add(key)
        unique.append(row)
        if len(unique) >= count:
            break

    if len(unique) < count:
        warnings.append(
            "Resultado da IA incompleto/duplicado; fallback aplicado para complementar missoes."
        )

    for row in fallback_rows:
        if len(unique) >= count:
            break
        key = _normalize_text(row.subject)
        if key in seen:
            continue
        seen.add(key)
        unique.append(replace(row, source=("mixed" if source_from_model else "fallback")))

    return unique[:count]


def _score_subject_similarity(old_subject: str, new_subject: str) -> float:
    old_norm = _normalize_text(old_subject)
    new_norm = _normalize_text(new_subject)
    if not old_norm or not new_norm:
        return 0.0
    if old_norm == new_norm:
        return 1.0

    if _subject_bucket(old_norm) == _subject_bucket(new_norm):
        return 0.82

    return SequenceMatcher(a=old_norm, b=new_norm).ratio()


def _candidate_order(old_subject: str, new_specs: list[MissionSpec]) -> list[int]:
    ranked = [
        (idx, _score_subject_similarity(old_subject, spec.subject))
        for idx, spec in enumerate(new_specs)
    ]
    ranked.sort(key=lambda item: item[1], reverse=True)
    return [idx for idx, _score in ranked]


def _fill_progress_with_capacity(
    *,
    amount: int,
    ordered_candidates: list[int],
    progress_bucket: list[int],
    capacities: list[int],
) -> int:
    remaining = max(0, int(amount))
    if remaining <= 0:
        return 0

    for idx in ordered_candidates:
        room = max(0, capacities[idx] - progress_bucket[idx])
        if room <= 0:
            continue
        used = min(room, remaining)
        progress_bucket[idx] += used
        remaining -= used
        if remaining <= 0:
            return 0

    if remaining > 0:
        for idx, _cap in sorted(
            enumerate(capacities),
            key=lambda item: (capacities[item[0]] - progress_bucket[item[0]]),
            reverse=True,
        ):
            room = max(0, capacities[idx] - progress_bucket[idx])
            if room <= 0:
                continue
            used = min(room, remaining)
            progress_bucket[idx] += used
            remaining -= used
            if remaining <= 0:
                break

    return remaining


def _migrate_progress(
    *,
    existing_rows: list[DailyQuest] | list[WeeklyQuest],
    new_specs: list[MissionSpec],
) -> list[tuple[int, bool]]:
    if not new_specs:
        return []

    capacities = [max(0, int(spec.target_minutes)) for spec in new_specs]
    progress_bucket = [0 for _ in new_specs]
    claimed_bucket = [False for _ in new_specs]

    ordered_rows = sorted(existing_rows, key=lambda row: bool(row.claimed), reverse=True)
    for row in ordered_rows:
        candidates = _candidate_order(row.subject, new_specs)
        if not candidates:
            continue

        migrated_amount = max(0, int(row.progress_minutes))
        best_idx = candidates[0]
        if bool(row.claimed):
            claimed_bucket[best_idx] = True
            progress_bucket[best_idx] = max(progress_bucket[best_idx], capacities[best_idx])
            migrated_amount = max(0, migrated_amount - capacities[best_idx])

        _fill_progress_with_capacity(
            amount=migrated_amount,
            ordered_candidates=candidates,
            progress_bucket=progress_bucket,
            capacities=capacities,
        )

    migrated: list[tuple[int, bool]] = []
    for idx, spec in enumerate(new_specs):
        progress = min(int(spec.target_minutes), progress_bucket[idx])
        claimed = claimed_bucket[idx]
        if claimed:
            progress = int(spec.target_minutes)
        migrated.append((progress, claimed))
    return migrated


async def generate_official_mission_specs(
    *,
    goals: dict[str, int],
    cycle: Literal["daily", "weekly", "both"],
    user_settings: UserSettings | None = None,
) -> MissionGenerationOutput:
    fallback_daily = build_fallback_missions(goals=goals, cycle="daily", count=5)
    fallback_weekly = build_fallback_missions(goals=goals, cycle="weekly", count=5)

    warnings: list[str] = []
    model_payload = await _try_generate_with_gemini(
        goals=goals, cycle=cycle, user_settings=user_settings
    )
    has_model = model_payload is not None

    model_daily: list[MissionSpec] = []
    model_weekly: list[MissionSpec] = []

    if model_payload is not None:
        model_daily = [
            _sanitize_generated_row(row, cycle="daily", goals=goals, source="gemini")
            for row in model_payload.daily
        ]
        model_weekly = [
            _sanitize_generated_row(row, cycle="weekly", goals=goals, source="gemini")
            for row in model_payload.weekly
        ]

    if cycle in {"daily", "both"}:
        daily_rows = _ensure_unique_and_complete(
            rows=model_daily,
            fallback_rows=fallback_daily,
            count=5,
            warnings=warnings,
            source_from_model=has_model,
        )
    else:
        daily_rows = fallback_daily

    if cycle in {"weekly", "both"}:
        weekly_rows = _ensure_unique_and_complete(
            rows=model_weekly,
            fallback_rows=fallback_weekly,
            count=5,
            warnings=warnings,
            source_from_model=has_model,
        )
    else:
        weekly_rows = fallback_weekly

    if not has_model:
        source: GenerationSource = "fallback"
    elif warnings:
        source = "mixed"
    else:
        source = "gemini"

    return MissionGenerationOutput(
        source=source, warnings=warnings, daily=daily_rows, weekly=weekly_rows
    )


def overwrite_daily_quests(
    *, session: Session, user: User, dk: str, specs: list[MissionSpec]
) -> list[DailyQuest]:
    existing = session.exec(
        select(DailyQuest).where(DailyQuest.user_id == user.id, DailyQuest.date_key == dk)
    ).all()
    migrated = _migrate_progress(existing_rows=existing, new_specs=specs)

    for row in existing:
        session.delete(row)
    session.flush()

    now_utc = datetime.now(timezone.utc)
    new_rows: list[DailyQuest] = []

    for idx, spec in enumerate(specs):
        progress, claimed = migrated[idx] if idx < len(migrated) else (0, False)
        row = DailyQuest(
            user_id=user.id,
            date_key=dk,
            subject=spec.subject,
            title=spec.title,
            description=spec.description,
            rank=spec.rank,
            difficulty=spec.difficulty,
            objective=spec.objective,
            tags_json=json.dumps(spec.tags),
            reward_xp=spec.reward_xp,
            reward_gold=spec.reward_gold,
            source=spec.source,
            generated_at=now_utc,
            target_minutes=int(spec.target_minutes),
            progress_minutes=int(progress),
            claimed=bool(claimed),
        )
        session.add(row)
        new_rows.append(row)

    session.commit()
    for row in new_rows:
        session.refresh(row)
    return new_rows


def overwrite_weekly_quests(
    *, session: Session, user: User, wk: str, specs: list[MissionSpec]
) -> list[WeeklyQuest]:
    existing = session.exec(
        select(WeeklyQuest).where(WeeklyQuest.user_id == user.id, WeeklyQuest.week_key == wk)
    ).all()
    migrated = _migrate_progress(existing_rows=existing, new_specs=specs)

    for row in existing:
        session.delete(row)
    session.flush()

    now_utc = datetime.now(timezone.utc)
    new_rows: list[WeeklyQuest] = []

    for idx, spec in enumerate(specs):
        progress, claimed = migrated[idx] if idx < len(migrated) else (0, False)
        row = WeeklyQuest(
            user_id=user.id,
            week_key=wk,
            subject=spec.subject,
            title=spec.title,
            description=spec.description,
            rank=spec.rank,
            difficulty=spec.difficulty,
            objective=spec.objective,
            tags_json=json.dumps(spec.tags),
            reward_xp=spec.reward_xp,
            reward_gold=spec.reward_gold,
            source=spec.source,
            generated_at=now_utc,
            target_minutes=int(spec.target_minutes),
            progress_minutes=int(progress),
            claimed=bool(claimed),
        )
        session.add(row)
        new_rows.append(row)

    session.commit()
    for row in new_rows:
        session.refresh(row)
    return new_rows
