# Migrations Policy (no drift)

This project uses **Alembic** for schema changes. For local dev/tests we may use
`AUTO_CREATE_DB=true`, but for staging/prod you should use migrations only.

## Rules

1. **Never change the DB schema directly** (manual SQL in prod, `create_all` in prod, etc).
2. Every schema change must come with:
   - a new Alembic revision (`alembic revision --autogenerate -m "..."`)
   - a quick manual review of the generated diff
   - `alembic upgrade head` applied locally (or in CI)
3. If you modify `app/models.py`, you must:
   - generate a migration
   - run the drift check script (`scripts/check_schema_drift.py`) after upgrading

## Local workflow (SQLite)

```bash
cd backend
export DATABASE_URL=sqlite:///./dev.db
export AUTO_CREATE_DB=false

alembic upgrade head
PYTHONPATH=. python scripts/check_schema_drift.py
```

## Local workflow (Postgres via Docker)

Use your docker-compose stack and run migrations inside the backend container (or locally with the same DATABASE_URL).

## Notes

- Views are created by migrations (see `v_user_daily_stats`, `v_user_monthly_stats`).
- If you enable persisted refresh tokens, remember to schedule cleanup:
  `PYTHONPATH=. python scripts/cleanup_refresh_tokens.py`
