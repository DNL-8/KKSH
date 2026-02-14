# CHECKLIST_RELEASE (CMD8 Fullstack)

Use este checklist para validacao local, release e deploy.

## 0) Pre-requisitos

- [ ] Docker Desktop rodando
- [ ] Portas 8000, 5432 e 6379 livres (ou remapeadas)
- [ ] `JWT_SECRET` forte para producao

## 1) Sanidade local

### 1.1 Subir stack fullstack

```powershell
docker compose up -d --build redis db api webhook_worker
```

### 1.2 Health

```powershell
curl http://localhost:8000/api/v1/health
```

Esperado: HTTP 200 com `{"ok": true, "checks": {"database": "ok", "redis": "ok|not_configured"}}`.

### 1.3 SPA same-origin

- [ ] `http://localhost:8000/hub` carrega
- [ ] `http://localhost:8000/combate` carrega
- [ ] `http://localhost:8000/revisoes` carrega
- [ ] `http://localhost:8000/arquivos` carrega
- [ ] `http://localhost:8000/evolucao` carrega
- [ ] `http://localhost:8000/ia` carrega
- [ ] `http://localhost:8000/config` carrega

## 2) Fluxo IA (proxy backend)

- [ ] Enviar mensagem no modulo IA
- [ ] Frontend chama `POST /api/v1/ai/hunter`
- [ ] Resposta de sucesso ou erro controlado aparece no chat

## 3) Qualidade backend

- [ ] `ruff check backend`
- [ ] `black --check backend`
- [ ] `mypy backend/app`
- [ ] `pytest -q backend/tests`

## 4) Qualidade frontend

- [ ] `pnpm lint:frontend`
- [ ] `pnpm typecheck`
- [ ] `pnpm build`

## 5) E2E

- [ ] `pnpm e2e` verde (smoke de abertura, rotas e IA)

## 6) Hardening de deploy

- [ ] `render.yaml` usando `Dockerfile` raiz
- [ ] `SERVE_FRONTEND=true`
- [ ] `FRONTEND_DIST_PATH=/app/dist/public`
- [ ] `AUTO_CREATE_DB=false`
- [ ] `SEED_DEV_DATA=false`
- [ ] `PERSIST_REFRESH_TOKENS=true`
- [ ] `WEBHOOK_SECRET_ENC_KEY` definido
- [ ] `WEBHOOK_OUTBOX_ENABLED=true`
- [ ] `WEBHOOK_OUTBOX_SEND_ENABLED=true`
- [ ] `CORS_ORIGINS` vazio (same-origin) ou lista explicita (cross-origin)
- [ ] Health check pos-deploy em `/api/v1/health`
- [ ] Worker dedicado rodando (`scripts/run_webhook_worker.py`)

## 7) Webhook outbox

- [ ] `python backend/scripts/run_webhook_worker.py --once` processa lote sem erro
- [ ] `python backend/scripts/requeue_webhook_outbox.py --all-dead --limit 10` executa com sucesso
- [ ] `python backend/scripts/cleanup_webhook_outbox.py` executa com sucesso
- [ ] Dashboard SQL executa sem erro (`backend/scripts/sql/webhook_outbox_dashboard.sql`)
- [ ] Fase de rollout documentada aplicada (`docs/webhook_outbox_rollout.md`)

## Definition of Done

- [ ] Smoke local aprovado
- [ ] Gates de qualidade aprovados
- [ ] E2E aprovado
- [ ] Deploy aprovado
