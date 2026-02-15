from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal, Optional

from pydantic import BaseModel, EmailStr, Field, StringConstraints, field_validator


class ErrorOut(BaseModel):
    code: str
    message: str
    details: Optional[object] = None


class AuthIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: EmailStr) -> str:
        return str(value).strip().lower()


class UserUpdateIn(BaseModel):
    username: Optional[str] = Field(default=None, min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")


class UserOut(BaseModel):
    id: str
    username: Optional[str] = None
    email: EmailStr
    isAdmin: bool = False


class AuthOut(BaseModel):
    user: UserOut


class CreateSessionIn(BaseModel):
    subject: str
    minutes: int = Field(ge=1, le=1440)
    mode: str = "pomodoro"
    notes: Optional[str] = Field(default=None, max_length=500)


class UpdateSessionIn(BaseModel):
    subject: Optional[str] = None
    minutes: Optional[int] = Field(default=None, ge=1, le=1440)
    mode: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=500)
    date: Optional[str] = Field(default=None, pattern=r"^\d{4}-\d{2}-\d{2}$")

    @field_validator("date")
    @classmethod
    def validate_date(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        try:
            return datetime.strptime(value, "%Y-%m-%d").strftime("%Y-%m-%d")
        except ValueError as exc:
            raise ValueError("date must be a valid YYYY-MM-DD") from exc


class SessionOut(BaseModel):
    id: str
    subject: str
    minutes: int
    mode: str
    notes: Optional[str] = None
    date: str
    createdAt: datetime
    # gamification (safe defaults)
    xpEarned: int = 0
    goldEarned: int = 0


class SessionListOut(BaseModel):
    sessions: list[SessionOut]
    nextCursor: Optional[str] = None


class DailyQuestOut(BaseModel):
    id: str
    date: str
    subject: str
    title: Optional[str] = None
    description: Optional[str] = None
    rank: Optional[str] = None
    difficulty: Optional[str] = None
    objective: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    rewardXp: Optional[int] = None
    rewardGold: Optional[int] = None
    source: str = "fallback"
    generatedAt: Optional[datetime] = None
    targetMinutes: int
    progressMinutes: int
    claimed: bool


class WeeklyQuestOut(BaseModel):
    id: str
    week: str
    subject: str
    title: Optional[str] = None
    description: Optional[str] = None
    rank: Optional[str] = None
    difficulty: Optional[str] = None
    objective: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    rewardXp: Optional[int] = None
    rewardGold: Optional[int] = None
    source: str = "fallback"
    generatedAt: Optional[datetime] = None
    targetMinutes: int
    progressMinutes: int
    claimed: bool


MissionCycle = Literal["daily", "weekly", "both"]


class RegenerateMissionsIn(BaseModel):
    cycle: MissionCycle = "both"
    reason: str = Field(default="manual", min_length=1, max_length=120)


class RegenerateMissionsOut(BaseModel):
    source: Literal["gemini", "fallback", "mixed"]
    nextAllowedAt: datetime
    warnings: list[str] = Field(default_factory=list)
    dailyQuests: list[DailyQuestOut] = Field(default_factory=list)
    weeklyQuests: list[WeeklyQuestOut] = Field(default_factory=list)


class InventoryItemOut(BaseModel):
    id: str
    name: str
    desc: str
    qty: int
    consumable: bool


class UseInventoryItemIn(BaseModel):
    itemId: str
    qty: int = Field(default=1, ge=1, le=99)


class UseInventoryItemOut(BaseModel):
    item: InventoryItemOut
    consumedQty: int
    vitals: Optional["VitalsOut"] = None


class LegacyStudyBlockOut(BaseModel):
    id: str
    dayOfWeek: int  # 0=Mon ... 6=Sun
    startTime: str  # HH:MM
    durationMin: int
    subject: str
    mode: str
    isActive: bool = True


class StudyBlockCreateIn(BaseModel):
    dayOfWeek: int = Field(ge=0, le=6)
    startTime: str = Field(min_length=4, max_length=5)
    durationMin: int = Field(ge=10, le=360)
    subject: str = Field(min_length=1, max_length=64)
    mode: str = Field(default="pomodoro", min_length=3, max_length=16)
    isActive: Optional[bool] = None


class StudyBlockUpdateIn(BaseModel):
    dayOfWeek: Optional[int] = Field(default=None, ge=0, le=6)
    startTime: Optional[str] = Field(default=None, min_length=4, max_length=5)
    durationMin: Optional[int] = Field(default=None, ge=10, le=360)
    subject: Optional[str] = Field(default=None, min_length=1, max_length=64)
    mode: Optional[str] = Field(default=None, min_length=3, max_length=16)
    isActive: Optional[bool] = None


class AppStateOut(BaseModel):
    user: UserOut
    onboardingDone: bool = False
    todayMinutes: int
    weekMinutes: int
    streakDays: int
    goals: dict[str, int]
    dueReviews: int
    dailyQuests: list[DailyQuestOut]
    weeklyQuests: list[WeeklyQuestOut] = []
    inventory: list[InventoryItemOut] = []
    studyBlocks: list[StudyBlockOut] = []
    settings: Optional["UserSettingsOut"] = None
    progression: Optional["ProgressionOut"] = None
    vitals: Optional["VitalsOut"] = None


class UserSettingsOut(BaseModel):
    dailyTargetMinutes: int
    pomodoroWorkMin: int
    pomodoroBreakMin: int
    timezone: str
    # extra settings (defaults for backward compatibility)
    language: str = "pt-BR"
    reminderEnabled: bool = True
    reminderTime: str = "20:00"
    reminderEveryMin: int = 5
    xpPerMinute: int = 5
    goldPerMinute: int = 1
    
    # New fields
    geminiApiKey: Optional[str] = None
    agentPersonality: str = "standard"


class UpdateSettingsIn(BaseModel):
    dailyTargetMinutes: Optional[int] = Field(default=None, ge=10, le=600)
    pomodoroWorkMin: Optional[int] = Field(default=None, ge=10, le=90)
    pomodoroBreakMin: Optional[int] = Field(default=None, ge=3, le=30)
    timezone: Optional[str] = Field(default=None, min_length=3, max_length=64)
    language: Optional[str] = Field(default=None, min_length=2, max_length=16)
    reminderEnabled: Optional[bool] = None
    reminderTime: Optional[str] = Field(default=None, min_length=4, max_length=5)
    reminderEveryMin: Optional[int] = Field(default=None, ge=1, le=180)
    xpPerMinute: Optional[int] = Field(default=None, ge=0, le=100)
    goldPerMinute: Optional[int] = Field(default=None, ge=0, le=100)
    geminiApiKey: Optional[str] = None
    agentPersonality: Optional[str] = Field(default=None, max_length=32)


ResetScope = Literal["missions", "progression", "sessions", "inventory", "reviews", "all"]


class ResetStateIn(BaseModel):
    scopes: list[ResetScope] = Field(default_factory=list)


class ResetStateOut(BaseModel):
    applied: list[ResetScope]
    summary: dict[str, int] = Field(default_factory=dict)


class ProgressionOut(BaseModel):
    level: int
    rank: str = "F"
    xp: int
    maxXp: int
    gold: int


class ApplyXpEventIn(BaseModel):
    eventType: Literal["video.lesson.completed", "review.completed", "combat.victory"]
    occurredAt: datetime
    sourceRef: Optional[str] = Field(default=None, min_length=3, max_length=180)
    payload: dict[str, object] = Field(default_factory=dict)


class ApplyXpEventOut(BaseModel):
    eventId: Optional[str] = None
    applied: bool = True
    xpDelta: int = 0
    goldDelta: int = 0
    progress: ProgressionOut


class MissionStartIn(BaseModel):
    context: dict[str, object] = Field(default_factory=dict)


class MissionStartOut(BaseModel):
    missionInstanceId: str
    status: Literal["in_progress"]
    startedAt: datetime


class ClaimMissionIn(BaseModel):
    reason: Literal["completed", "manual"] = "completed"


class MissionRewardOut(BaseModel):
    xp: int
    gold: int
    items: list[dict[str, object]] = Field(default_factory=list)


class ClaimMissionOut(BaseModel):
    claimId: str
    reward: MissionRewardOut
    progress: ProgressionOut


class MissionListItemOut(BaseModel):
    missionInstanceId: str
    cycle: Literal["daily", "weekly"]
    subject: str
    targetMinutes: int
    progressMinutes: int
    claimed: bool
    reward: MissionRewardOut


class MissionListOut(BaseModel):
    daily: list[MissionListItemOut] = Field(default_factory=list)
    weekly: list[MissionListItemOut] = Field(default_factory=list)


class ProgressQueryOut(BaseModel):
    level: int
    rank: str
    xp: int
    maxXp: int
    gold: int
    streakDays: int
    vitals: dict[str, int]


class XpHistoryEventOut(BaseModel):
    id: str
    eventType: str
    sourceType: str
    sourceRef: str
    xpDelta: int
    goldDelta: int
    rulesetVersion: int
    createdAt: datetime


class XpHistoryOut(BaseModel):
    events: list[XpHistoryEventOut] = Field(default_factory=list)


class LeaderboardEntryOut(BaseModel):
    position: int
    userId: str
    label: str
    xpTotal: int
    goldTotal: int


class LeaderboardOut(BaseModel):
    scope: Literal["weekly"] = "weekly"
    entries: list[LeaderboardEntryOut] = Field(default_factory=list)


class CombatQuestionOut(BaseModel):
    id: str
    text: str
    options: list[str] = Field(default_factory=list)


class CombatBattleStateOut(BaseModel):
    battleId: str
    playerHp: int
    playerMaxHp: int
    enemyHp: int
    enemyMaxHp: int
    turn: Literal["PLAYER_IDLE", "PLAYER_QUIZ", "VICTORY", "DEFEAT", "ENEMY_TURN", "PLAYER_ATTACKING"]
    status: Literal["ongoing", "victory", "defeat"]


class CombatBossOut(BaseModel):
    name: str
    rank: str
    hp: int


class CombatStartIn(BaseModel):
    moduleId: Optional[str] = None
    reset: bool = False


class CombatStartOut(BaseModel):
    moduleId: str
    boss: CombatBossOut
    battleState: CombatBattleStateOut
    question: Optional[CombatQuestionOut] = None
    progress: ProgressionOut


class CombatQuestionIn(BaseModel):
    battleId: str


class CombatQuestionOutEnvelope(BaseModel):
    battleState: CombatBattleStateOut
    question: CombatQuestionOut


class CombatAnswerIn(BaseModel):
    battleId: str
    questionId: str
    optionIndex: int = Field(ge=0, le=3)


class CombatAnswerOut(BaseModel):
    result: Literal["correct", "incorrect"]
    playerDamage: int
    enemyDamage: int
    battleState: CombatBattleStateOut
    progress: ProgressionOut


class VitalsOut(BaseModel):
    hp: int
    maxHp: int
    mana: int
    maxMana: int
    fatigue: int
    maxFatigue: int


class SubjectOut(BaseModel):
    id: str
    name: str
    color: Optional[str] = None
    icon: Optional[str] = None
    isActive: bool = True
    createdAt: datetime
    updatedAt: datetime


class SubjectListOut(BaseModel):
    subjects: list[SubjectOut]


class SubjectCreateIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    color: Optional[str] = Field(default=None, max_length=32)
    icon: Optional[str] = Field(default=None, max_length=32)
    isActive: bool = True


class SubjectUpdateIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=40)
    color: Optional[str] = Field(default=None, max_length=32)
    icon: Optional[str] = Field(default=None, max_length=32)
    isActive: Optional[bool] = None


class OnboardingStatusOut(BaseModel):
    onboardingDone: bool
    goals: dict[str, int]
    settings: UserSettingsOut


class OnboardingCompleteIn(BaseModel):
    goals: dict[str, int]
    dailyTargetMinutes: int = Field(ge=10, le=600)
    pomodoroWorkMin: int = Field(ge=10, le=90)
    pomodoroBreakMin: int = Field(ge=3, le=30)
    timezone: str = Field(min_length=3, max_length=64)


class StudyPlanIn(BaseModel):
    goals: dict[str, int]


class StudyPlanOut(BaseModel):
    goals: dict[str, int]


class ReviewQueueItemOut(BaseModel):
    drillId: str
    nextReviewAt: datetime


class ReviewQueueOut(BaseModel):
    due: list[ReviewQueueItemOut]


class DrillReviewIn(BaseModel):
    drillId: str
    result: Literal["good", "again"]
    # optional training meta (for review mode / stats)
    elapsedMs: Optional[int] = Field(default=None, ge=0, le=3_600_000)
    difficulty: Optional[str | int] = None


class LegacyDueDrillOut(BaseModel):
    drillId: str
    subject: str
    question: str
    answer: str
    nextReviewAt: datetime
    intervalDays: int
    reps: int
    ease: float


class LegacyReviewStatsOut(BaseModel):
    dueCount: int
    totalAnswered: int
    goodCount: int
    againCount: int
    goodRate: float
    avgTimeMs: Optional[float] = None
    maturity: dict[str, int]


class DrillOut(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    subject: str = Field(min_length=1, max_length=80)
    question: str = Field(min_length=1, max_length=2000)
    answer: str = Field(min_length=1, max_length=8000)
    tags: list[str] = Field(default_factory=list, max_length=100)


class DrillListOut(BaseModel):
    drills: list[DrillOut]
    nextCursor: Optional[str] = None


class DrillCreateIn(BaseModel):
    subject: str = Field(min_length=1, max_length=80)
    question: str = Field(min_length=3, max_length=500)
    answer: str = Field(min_length=1, max_length=2000)
    tags: list[str] = Field(default_factory=list, max_length=100)
    isActive: bool = True


class DrillUpdateIn(BaseModel):
    subject: Optional[str] = Field(default=None, min_length=1, max_length=80)
    question: Optional[str] = Field(default=None, min_length=3, max_length=500)
    answer: Optional[str] = Field(default=None, min_length=1, max_length=2000)
    tags: Optional[list[str]] = None
    isActive: Optional[bool] = None


class BackupSessionOut(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    subject: str = Field(min_length=1, max_length=80)
    minutes: int = Field(ge=1, le=1440)
    mode: str = Field(min_length=2, max_length=32)
    notes: Optional[str] = Field(default=None, max_length=1000)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    startedAt: datetime
    createdAt: datetime


class BackupQuestOut(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    subject: str = Field(min_length=1, max_length=80)
    title: Optional[str] = Field(default=None, max_length=240)
    description: Optional[str] = Field(default=None, max_length=4000)
    rank: Optional[str] = Field(default=None, max_length=24)
    difficulty: Optional[str] = Field(default=None, max_length=32)
    objective: Optional[str] = Field(default=None, max_length=800)
    tags: list[str] = Field(default_factory=list, max_length=100)
    rewardXp: Optional[int] = None
    rewardGold: Optional[int] = None
    source: str = Field(default="fallback", max_length=64)
    generatedAt: Optional[datetime] = None
    targetMinutes: int = Field(ge=0, le=10080)
    progressMinutes: int = Field(ge=0, le=10080)
    claimed: bool


class BackupReviewOut(BaseModel):
    id: str = Field(min_length=1, max_length=128)
    drillId: str = Field(min_length=1, max_length=128)
    nextReviewAt: datetime
    intervalDays: int = Field(ge=0, le=3650)
    ease: float = Field(ge=0.0, le=10.0)
    reps: int = Field(ge=0, le=10000)
    lastResult: Optional[str] = Field(default=None, max_length=32)
    updatedAt: datetime


class BackupOut(BaseModel):
    version: int = 1
    exportedAt: datetime
    user: UserOut
    goals: dict[str, int]
    sessions: list[BackupSessionOut]
    dailyQuests: list[BackupQuestOut]
    drillReviews: list[BackupReviewOut]
    customDrills: list[DrillOut] = []


class BackupImportIn(BaseModel):
    version: int = 1
    goals: dict[str, int] = Field(default_factory=dict)
    sessions: list[BackupSessionOut] = Field(default_factory=list)
    dailyQuests: list[BackupQuestOut] = Field(default_factory=list)
    drillReviews: list[BackupReviewOut] = Field(default_factory=list)
    customDrills: list[DrillOut] = Field(default_factory=list)


class WeeklyReportDayOut(BaseModel):
    date: str
    minutes: int


class WeeklyReportSubjectOut(BaseModel):
    subject: str
    minutes: int


class WeeklyReportOut(BaseModel):
    from_: str = Field(alias="from")
    to: str
    totalMinutes: int
    byDay: list[WeeklyReportDayOut]
    bySubject: list[WeeklyReportSubjectOut]
    streakDays: int


class MonthlyReportRowOut(BaseModel):
    month: str  # YYYY-MM
    minutes: int
    sessions: int = 0
    xp: int = 0
    gold: int = 0


class MonthlyReportOut(BaseModel):
    months: list[MonthlyReportRowOut]


# -------------------- Achievements --------------------


class AchievementOut(BaseModel):
    key: str
    name: str
    description: str
    icon: Optional[str] = None
    unlocked: bool
    unlockedAt: Optional[datetime] = None


# -------------------- Webhooks / Integrations --------------------


WebhookUrl = Annotated[str, StringConstraints(strip_whitespace=True, min_length=8, max_length=2048)]
WebhookEvent = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True, min_length=1, max_length=64, pattern=r"^[a-z0-9_.-]+$"
    ),
]
WebhookSecret = Annotated[str, StringConstraints(min_length=8, max_length=256)]

ALLOWED_WEBHOOK_EVENTS = frozenset(
    {
        "session.created",
        "session.updated",
        "session.deleted",
        "drill.reviewed",
        "test",
    }
)


def _normalize_webhook_events(events: list[str]) -> list[str]:
    deduped: list[str] = []
    seen: set[str] = set()
    for event in events:
        if event not in ALLOWED_WEBHOOK_EVENTS:
            raise ValueError(f"unsupported webhook event: {event}")
        if event in seen:
            continue
        seen.add(event)
        deduped.append(event)
    return deduped


class WebhookCreateIn(BaseModel):
    url: WebhookUrl
    events: list[WebhookEvent] = Field(default_factory=list, max_length=20)
    secret: Optional[WebhookSecret] = None
    isActive: bool = True

    @field_validator("events")
    @classmethod
    def validate_events(cls, value: list[str]) -> list[str]:
        return _normalize_webhook_events(value)


class WebhookUpdateIn(BaseModel):
    url: Optional[WebhookUrl] = None
    events: Optional[list[WebhookEvent]] = Field(default=None, max_length=20)
    secret: Optional[WebhookSecret] = None
    isActive: Optional[bool] = None

    @field_validator("events")
    @classmethod
    def validate_events(cls, value: Optional[list[str]]) -> Optional[list[str]]:
        if value is None:
            return value
        return _normalize_webhook_events(value)


class WebhookOut(BaseModel):
    id: str
    url: str
    events: list[str]
    isActive: bool
    createdAt: datetime
    updatedAt: datetime


class StudyBlockOut(BaseModel):
    id: str
    dayOfWeek: int
    startTime: str
    durationMin: int
    subject: str
    mode: str
    isActive: bool


class StudyBlockIn(BaseModel):
    dayOfWeek: int = Field(ge=0, le=6)
    startTime: str = Field(min_length=4, max_length=5)
    durationMin: int = Field(ge=10, le=480)
    subject: str
    mode: str = "pomodoro"
    isActive: bool = True


class UpdateStudyBlockIn(BaseModel):
    dayOfWeek: Optional[int] = Field(default=None, ge=0, le=6)
    startTime: Optional[str] = Field(default=None, min_length=4, max_length=5)
    durationMin: Optional[int] = Field(default=None, ge=10, le=480)
    subject: Optional[str] = None
    mode: Optional[str] = None
    isActive: Optional[bool] = None


class RecommendationOut(BaseModel):
    kind: str
    title: str
    description: str
    subject: Optional[str] = None
    cta: Optional[str] = None


class DueDrillOut(BaseModel):
    drillId: str
    subject: str
    question: str
    answer: str
    nextReviewAt: datetime
    intervalDays: int
    ease: float
    reps: int


class ReviewStatsOut(BaseModel):
    dueCount: int
    totalAnswered: int
    goodCount: int
    againCount: int
    goodRate: float
    avgTimeMs: Optional[float] = None
    maturity: dict[str, int]
