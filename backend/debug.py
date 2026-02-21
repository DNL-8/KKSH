import asyncio
from fastapi.testclient import TestClient
from app.main import app

def run():
    client = TestClient(app)
    r = client.post("/api/v1/auth/signup", json={"email": "debug2@example.com", "password": "123"})
    print("Signup", r.status_code)
    
    r = client.get("/api/v1/auth/csrf")
    csrf = r.headers.get("x-csrf-token", "")
    
    h = {"Idempotency-Key": "test-idem-123"}
    if csrf:
        h["X-CSRF-Token"] = csrf
        
    payload = {
        "eventType": "video.lesson.completed",
        "occurredAt": "2026-02-14T15:22:00Z",
        "sourceRef": "session:test-debug",
        "payload": {
            "minutes": 12,
        },
    }
    
    r2 = client.post("/api/v1/events", json=payload, headers=h)
    print("Create Event:", r2.status_code)
    print(r2.json())

run()
