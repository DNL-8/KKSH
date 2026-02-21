from app.schemas.progression import ApplyXpEventIn
from pydantic import ValidationError

payload = {
    "eventType": "video.lesson.completed",
    "occurredAt": "2026-02-14T15:22:00Z",
    "sourceRef": "session:test-debug",
    "payload": {
        "minutes": 12,
    },
}

try:
    ApplyXpEventIn(**payload)
    print("Schema is valid!")
except ValidationError as e:
    print("Validation Error:")
    print(e.json())
