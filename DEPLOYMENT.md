# Deployment notes (Fullstack same-origin)

## Topology target

Production should run in same-origin mode:

- Frontend build (`dist/public`) served by FastAPI
- APIs under `/api/v1/*`
- Web routes: `/hub`, `/combate`, `/revisoes`, `/arquivos`, `/evolucao`, `/ia`, `/config`
- Worker dedicado para `webhook_outbox`

## Required production settings

- `ENV=prod`
- `DATABASE_URL=...`
- `JWT_SECRET=<strong-random-value>`
- `PERSIST_REFRESH_TOKENS=true`
- `AUTO_CREATE_DB=false`
- `SEED_DEV_DATA=false`
- `SERVE_FRONTEND=true`
- `FRONTEND_DIST_PATH=/app/dist/public`
- `WEBHOOK_SECRET_ENC_KEY=<fernet-key-or-strong-secret>`
- `WEBHOOK_OUTBOX_ENABLED=true`
- `WEBHOOK_OUTBOX_SEND_ENABLED=true`

If `METRICS_ENABLED=true`, also set:

- `METRICS_TOKEN=<strong-random-value>`

## CORS

There is no localhost fallback.

- Keep `CORS_ORIGINS` empty for same-origin deployments.
- Set explicit origins only when you have real cross-origin browser clients.
- `*` is rejected by config validation.

## Build/runtime

Use root `Dockerfile` (multi-stage):

1. Node stage builds frontend into `dist/public`
2. Python stage runs FastAPI and serves the web build

## Render

`render.yaml` is configured with:

- web service (`study-leveling`) serving API + SPA
- worker service (`study-leveling-webhook-worker`) processing `webhook_outbox`
- `WEBHOOK_OUTBOX_ENABLED=true`
- `WEBHOOK_OUTBOX_SEND_ENABLED=true`

Configure secrets in Render dashboard:

- `DATABASE_URL`
- `JWT_SECRET`
- `WEBHOOK_SECRET_ENC_KEY`
- `GEMINI_API_KEY` (if AI enabled — stored encrypted with Fernet)
- `METRICS_TOKEN` (if metrics enabled)

## CSRF

Cookie-auth flow:

- `GET /api/v1/auth/csrf` to mint token
- Mutating requests must send `X-CSRF-Token`

## Health/observability

- Health: `/api/v1/health` (checks DB + Redis connectivity, returns `503` on failure)
- Metrics: `/metrics` (protect in production)
- Web Vitals: `/api/v1/reports/web-vitals` (frontend CLS/INP/LCP reporting)

## Post-deploy smoke

1. `GET /api/v1/health` returns 200 with `{"ok": true, "checks": {"database": "ok"}}`
2. `GET /hub` returns app HTML
3. Route navigation works without 404
4. `POST /api/v1/ai/hunter` works (or controlled upstream error)
5. Worker logs show `webhook_outbox_claimed/sent/retry/dead` events

## Rollout guide and observability

- Rollout faseado: `docs/webhook_outbox_rollout.md`
- SQL dashboard (fila/retry/dead): `backend/scripts/sql/webhook_outbox_dashboard.sql`
- Plano de remocao do legado: `docs/webhook_outbox_legacy_sunset.md`
