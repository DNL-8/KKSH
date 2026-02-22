"""Models package — re-exports all models for backward compatibility.

All existing ``from app.models import X`` statements continue to work.
"""

from __future__ import annotations

# base helper
from .base import utcnow  # noqa: F401

# user domain
from .user import SystemRPGStats, User, UserInventory, UserSettings, UserStats  # noqa: F401

# study domain
from .study import StudyBlock, StudyPlan, StudySession, Subject  # noqa: F401

# quest domain
from .quest import DailyQuest, RewardClaim, WeeklyQuest  # noqa: F401

# drill domain
from .drill import Drill, DrillReview  # noqa: F401

# combat domain
from .combat import CombatBattle  # noqa: F401

# webhook domain
from .webhook import UserWebhook, WebhookOutbox  # noqa: F401

# system / infrastructure domain
from .system import (  # noqa: F401
    AuditEvent,
    CommandIdempotency,
    RefreshToken,
    SystemWindowMessage,
    UserAchievement,
    XpLedgerEvent,
)
