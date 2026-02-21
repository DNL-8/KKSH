"""Schemas package — re-exports all schemas for backward compatibility.

All existing ``from app.schemas import X`` statements continue to work.
"""

# auth
from .auth import AuthIn, AuthOut, ErrorOut, UserOut, UserUpdateIn  # noqa: F401

# sessions
from .sessions import CreateSessionIn, SessionListOut, SessionOut, UpdateSessionIn  # noqa: F401

# quests / missions
from .quests import (  # noqa: F401
    ClaimMissionIn,
    ClaimMissionOut,
    DailyQuestOut,
    MissionCycle,
    MissionListItemOut,
    MissionListOut,
    MissionRewardOut,
    MissionStartIn,
    MissionStartOut,
    RegenerateMissionsIn,
    RegenerateMissionsOut,
    WeeklyQuestOut,
)

# progression / vitals / inventory
from .progression import (  # noqa: F401
    ApplyXpEventIn,
    ApplyXpEventOut,
    InventoryItemOut,
    ProgressionOut,
    ProgressQueryOut,
    UseInventoryItemIn,
    UseInventoryItemOut,
    VitalsOut,
    XpHistoryEventOut,
    XpHistoryOut,
)

# combat
from .combat import (  # noqa: F401
    CombatAnswerIn,
    CombatAnswerOut,
    CombatBattleStateOut,
    CombatBossOut,
    CombatQuestionIn,
    CombatQuestionOut,
    CombatQuestionOutEnvelope,
    CombatStartIn,
    CombatStartOut,
)

# settings / app state
from .settings import (  # noqa: F401
    AppStateOut,
    ResetScope,
    ResetStateIn,
    ResetStateOut,
    StudyBlockOut,
    UpdateSettingsIn,
    UserSettingsOut,
)

# webhooks
from .webhooks import (  # noqa: F401
    ALLOWED_WEBHOOK_EVENTS,
    WebhookCreateIn,
    WebhookEvent,
    WebhookOut,
    WebhookSecret,
    WebhookUpdateIn,
    WebhookUrl,
)

# study / subjects / onboarding / blocks
from .study import (  # noqa: F401
    LegacyStudyBlockOut,
    OnboardingCompleteIn,
    OnboardingStatusOut,
    RecommendationOut,
    StudyBlockCreateIn,
    StudyBlockIn,
    StudyBlockUpdateIn,
    StudyPlanIn,
    StudyPlanOut,
    SubjectCreateIn,
    SubjectListOut,
    SubjectOut,
    SubjectUpdateIn,
    UpdateStudyBlockIn,
)

# drills / reviews
from .drills import (  # noqa: F401
    DrillCreateIn,
    DrillListOut,
    DrillOut,
    DrillReviewIn,
    DrillUpdateIn,
    DueDrillOut,
    LegacyDueDrillOut,
    LegacyReviewStatsOut,
    ReviewQueueItemOut,
    ReviewQueueOut,
    ReviewStatsOut,
)

# backup
from .backup import (  # noqa: F401
    BackupImportIn,
    BackupOut,
    BackupQuestOut,
    BackupReviewOut,
    BackupSessionOut,
)

# reports / leaderboard / achievements
from .reports import (  # noqa: F401
    AchievementOut,
    LeaderboardEntryOut,
    LeaderboardOut,
    MonthlyReportOut,
    MonthlyReportRowOut,
    WeeklyReportDayOut,
    WeeklyReportOut,
    WeeklyReportSubjectOut,
)
