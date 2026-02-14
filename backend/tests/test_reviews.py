from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select

from app.db import engine
from app.models import DrillReview, User


def _signup(client, csrf_headers, email="c@example.com"):
    r = client.post(
        "/api/v1/auth/signup",
        json={"email": email, "password": "secret123"},
        headers=csrf_headers(),
    )
    assert r.status_code == 200


def test_review_flow_and_queue(client, csrf_headers):
    _signup(client, csrf_headers)

    # create a review via API
    r = client.post(
        "/api/v1/drills/review",
        json={"drillId": "sql-joins-1", "result": "good"},
        headers=csrf_headers(),
    )
    assert r.status_code == 204

    # queue should be empty because next_review_at is in the future
    q = client.get("/api/v1/reviews/queue").json()
    assert q["due"] == []

    # force a due review directly in DB to validate queue ordering
    with Session(engine) as s:
        user = s.exec(select(User).where(User.email == "c@example.com")).first()
        assert user is not None
        dr = s.exec(
            select(DrillReview).where(
                DrillReview.user_id == user.id, DrillReview.drill_id == "sql-joins-1"
            )
        ).first()
        assert dr is not None
        dr.next_review_at = datetime.now(timezone.utc) - timedelta(days=1)
        s.add(dr)
        s.commit()

    q2 = client.get("/api/v1/reviews/queue").json()
    assert len(q2["due"]) == 1
    assert q2["due"][0]["drillId"] == "sql-joins-1"
