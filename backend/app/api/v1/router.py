from fastapi import APIRouter

from app.api.v1 import (
    achievements,
    ai,
    auth,
    backup,
    combat,
    drills,
    events,
    inventory,
    me,
    missions,
    onboarding,
    progress,
    quests,
    reports,
    reviews,
    sessions,
    settings,
    study_blocks,
    study_plan,
    subjects,
    webhooks,
    weekly_quests,
)

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router, tags=["auth"], prefix="/auth")
api_router.include_router(ai.router)
api_router.include_router(ai.chat_router)
api_router.include_router(combat.router)
api_router.include_router(events.router, tags=["events"])
api_router.include_router(me.router, tags=["me"])
api_router.include_router(missions.router)
api_router.include_router(progress.router, tags=["progress"])
api_router.include_router(sessions.router, tags=["sessions"], prefix="/sessions")
api_router.include_router(study_plan.router, tags=["study-plan"], prefix="/study-plan")
api_router.include_router(quests.router, tags=["daily-quests"], prefix="/daily-quests")
api_router.include_router(drills.router, tags=["drills"], prefix="/drills")
api_router.include_router(reviews.router, tags=["reviews"], prefix="/reviews")
api_router.include_router(reports.router, tags=["reports"], prefix="/reports")
api_router.include_router(backup.router, tags=["backup"], prefix="/backup")

api_router.include_router(achievements.router)
api_router.include_router(webhooks.router)

api_router.include_router(weekly_quests.router, tags=["weekly-quests"], prefix="/weekly-quests")
api_router.include_router(study_blocks.router, tags=["study-blocks"], prefix="/study-blocks")
api_router.include_router(inventory.router, tags=["inventory"])

api_router.include_router(settings.router, tags=["settings"], prefix="/settings")
api_router.include_router(subjects.router, tags=["subjects"], prefix="/subjects")

api_router.include_router(onboarding.router, tags=["onboarding"], prefix="/onboarding")
