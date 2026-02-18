# Study Leveling (Fullstack)

Aplicacao fullstack com backend FastAPI e frontend React + Vite + Tailwind, servida em same-origin em producao.

## Stack

- Backend: FastAPI + SQLModel + Alembic
- Frontend: React 18 + TypeScript + Vite 5 + Tailwind v3
- IA: Google Gemini (`google-genai` SDK)
- Banco: Postgres (Docker) / SQLite (local)
- Cache/rate limiting compartilhado: Redis
- E2E: Playwright
- CI: GitHub Actions

## Rotas web

- `/hub`
- `/combate`
- `/revisoes`
- `/arquivos`
- `/evolucao`
- `/ia`
- `/config`
- `/` redireciona para `/hub`
- Rotas desconhecidas exibem pagina 404 tematica

## Rodando local

### Modo rapido (Vite + API)

```bash
pnpm install
python -m pip install -r backend/requirements.txt -r backend/requirements-dev.txt
pnpm dev:all
```

- Frontend: `http://127.0.0.1:3000/hub`
- API: `http://localhost:8000`
- Docs: `http://localhost:8000/docs`

### Docker same-origin (stack completa)

```bash
docker compose up -d --build redis db api webhook_worker
```

- App: `http://localhost:8000/hub`
- Health: `http://localhost:8000/api/v1/health`
- Docs: `http://localhost:8000/docs`

## Build frontend

```bash
pnpm build
```

Output: `dist/public`.

## IA via proxy backend

O frontend usa `POST /api/v1/ai/hunter` (sem chave no cliente). A chave Gemini fica apenas no backend (`GEMINI_API_KEY`).

- SDK: `google-genai` (Client-based API)
- Chave do usuario encriptada com Fernet no DB (mesma infra dos webhook secrets)
- Response mascara a chave (ex: `AIza****abcd`)
- Rate limit de burst aplicado por IP (camada compartilhada) e por usuario autenticado
- Quota diaria configuravel separada para guest e usuario autenticado
- Logs/metricas de IA evitam persistir prompt bruto por padrao

## Arquivos locais (/arquivos)

- A tela `Arquivos` carrega videos locais via seletor do navegador (`input file`).
- Tambem e possivel carregar uma pasta inteira; o app importa apenas os arquivos de video encontrados.
- Para bibliotecas grandes, use `Conectar pasta (alto volume)` (File System Access API) para catalogar por handle sem copiar todo blob para o IndexedDB.
- O layout segue o modelo de curso: player principal + trilha lateral por pasta + abas de detalhes.
- Ao carregar pasta, o app preserva o caminho relativo (estrutura de pastas) e organiza as aulas por pasta na trilha lateral.
- Controles disponiveis: `Selecionar videos`, `Carregar pasta`, `Conectar pasta (alto volume)`, `Ordem` e `Limpar biblioteca`.
- Em mobile, o painel de conteudo abre como drawer/overlay via botao `Conteudo`.
- Os videos ficam salvos no IndexedDB local (`cmd8_local_media` / `videos`).
- Itens podem ficar em dois modos: `Local (Blob)` ou `Conectado (Handle)`.
- Meta operacional atual do app: ate `5000` videos catalogados por navegador/perfil.
- Em falta de espaco de quota para blobs, a importacao continua e os excedentes entram como `sem espaco` no resumo.
- A trilha lateral carrega em blocos por pasta (120 iniciais + `Mostrar mais`) para manter responsividade com colecoes grandes.
- Nao ha upload de midia para o backend nesta fase.
- Por seguranca do navegador, o app nao acessa caminho absoluto do sistema operacional.
- O modo `Conectar pasta` exige navegador Chromium; mover/deletar arquivos no disco pode invalidar handles.
- Upload avulso (arquivo unico) entra no grupo `Arquivos avulsos`.
- Para contabilizar RPG (XP/nivel/rank), ha mini login na propria pagina usando API cookie-auth.
- O ganho de XP por aula concluida e calculado pela API por duracao (`minutes = ceil(duracao/60)`).
- A conclusao e manual (botao `Concluir aula (+XP)`), com dedupe por video (`notes=video_completion::<videoRef>`).
- O `videoRef` de dedupe agora usa identificador estavel `v2` (hash parcial SHA-256 quando possivel, com fallback por metadados).
- O backend aplica dedupe server-side para `video_lesson`, retornando `200` com `xpEarned=0`/`goldEarned=0` em repeticao.
- Sem login, a biblioteca local funciona normalmente, mas sem contabilizar progressao RPG.
- O progresso RPG sincroniza com `/api/v1/me/state` e atualiza HUD global.
- O dedupe de aula concluida persiste por conta (via sessoes `mode=video_lesson`).
- Dados de blobs locais nao sincronizam entre dispositivos/navegadores.
- Se limpar os dados do navegador, a biblioteca local sera perdida.

## Variaveis importantes

- `SERVE_FRONTEND` habilita serving web no FastAPI
- `FRONTEND_DIST_PATH` caminho do build (`dist/public` por padrao)
- `CORS_ORIGINS` lista explicita de origens permitidas
- `WEBHOOK_OUTBOX_ENABLED` habilita persistencia de eventos de webhook em outbox
- `WEBHOOK_OUTBOX_SEND_ENABLED` ativa processamento por worker (desativa envio legacy in-process)
- `WEBHOOK_WORKER_*` controla batch/poll/locks/retries/backoff do worker
- `WEBHOOK_WORKER_HEARTBEAT_FILE` e `WEBHOOK_WORKER_HEARTBEAT_MAX_AGE_SEC` controlam healthcheck do worker
- `WEBHOOK_DELIVERY_TIMEOUT_SEC` timeout de entrega HTTP por webhook
- `GEMINI_API_KEY` chave de API do Gemini (fallback do sistema)
- `AI_GUEST_DAILY_MAX` e `AI_GUEST_DAILY_WINDOW_SEC` quota diaria para guests
- `AI_USER_DAILY_MAX` e `AI_USER_DAILY_WINDOW_SEC` quota diaria para usuarios autenticados
- `AI_RATE_LIMIT_MAX` e `AI_RATE_LIMIT_WINDOW_SEC` burst de IA (IP compartilhado + usuario)
- `WEBHOOK_SECRET_ENC_KEY_PREV` lista (csv) de chaves antigas aceitas temporariamente durante rotacao

## Hardening de producao

- `AUTO_CREATE_DB=false`
- `SEED_DEV_DATA=false`
- `PERSIST_REFRESH_TOKENS=true`
- `JWT_SECRET` forte (>=32)
- `WEBHOOK_SECRET_ENC_KEY` definido
- `CORS_ORIGINS` vazio para same-origin (ou lista explicita para cross-origin)

### Sessao, CSRF e CSP

- Auth por cookie com `HttpOnly`, `Secure` (prod/staging), `SameSite` configuravel (`lax|strict|none`) e `Path` controlado por config.
- `SameSite=None` so e aceito com cookie `Secure=true` (validacao de startup em prod/staging).
- Protecao CSRF ativa para metodos mutaveis via double-submit cookie:
  - endpoint `GET /api/v1/auth/csrf` emite token
  - cliente envia `X-CSRF-Token` com o mesmo valor do cookie
  - token e rotacionado em `signup/login/refresh/logout`
- Em producao (`Secure=true`), o cookie CSRF usa prefixo `__Host-` para mitigar injecao por subdominio.
- CSRF e aplicado apenas quando ha cookies de sessao (nao bloqueia requests publicos/bearer sem cookie).
- Headers de seguranca aplicados por padrao: `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, `HSTS` (HTTPS em prod).
- CSP same-origin padrao:
  - `default-src/script-src/connect-src 'self'`
  - `script-src-attr 'none'` (bloqueia handlers inline)
  - `style-src-attr 'none'` (sem inline style em atributos)
  - `object-src 'none'`, `frame-src 'none'`, `frame-ancestors 'none'`

## SEO & PWA

- `robots.txt` e `sitemap.xml` em `client/public/`
- `manifest.webmanifest` para PWA (installable)
- Open Graph e Twitter Card em `index.html`
- Schema.org JSON-LD injetado em runtime por `client/src/lib/structuredData.ts` (sem inline script no HTML)
- Google Fonts com `display=swap`
- Web Vitals (CLS/INP/LCP) reportados ao backend

## Acessibilidade

- Skip-to-content link
- ARIA attributes nos toggles (`role="switch"`, `aria-checked`)
- Focus-visible ring global
- Font-size minimo 11px

## Observabilidade

- Logs JSON com `request_id` e campos `extra` estruturados (inclui `worker_id`, `outbox_id`, `correlation_id` quando presentes).
- Metricas Prometheus para IA (`ai_request_duration_seconds`, `ai_request_errors_total`, `ai_rate_limited_total`).
- Metricas Prometheus para webhook outbox (`webhook_outbox_sent_total`, `webhook_outbox_retry_total`, `webhook_outbox_dead_total`, `webhook_outbox_queue_depth`).
- Healthcheck da API: `GET /api/v1/health` (DB + Redis).
- Healthcheck dedicado do worker: `python backend/scripts/webhook_worker_healthcheck.py`.

## Scripts uteis

- `pnpm dev:client`
- `pnpm dev:api`
- `pnpm dev:all`
- `pnpm build`
- `pnpm e2e`
- `pnpm check`
- `$env:ANALYZE="true"; pnpm build:client` (gera `stats.html` com mapa de bundle)
- `PYTHONPATH=. python backend/scripts/run_webhook_worker.py --once`
- `PYTHONPATH=. python backend/scripts/webhook_worker_healthcheck.py`
- `PYTHONPATH=. python backend/scripts/requeue_webhook_outbox.py --all-dead --limit 100`
- `PYTHONPATH=. python backend/scripts/cleanup_webhook_outbox.py --sent-days 14 --shadow-days 7 --dead-days 30`
- `PYTHONPATH=. python backend/scripts/reencrypt_secrets.py` (dry-run)
- `PYTHONPATH=. python backend/scripts/reencrypt_secrets.py --apply`

## Runbooks webhook outbox

- Rollout gradual: `docs/webhook_outbox_rollout.md`
- Sunset do caminho legado (release futura): `docs/webhook_outbox_legacy_sunset.md`
- Dashboard SQL (Postgres): `backend/scripts/sql/webhook_outbox_dashboard.sql`
- Healthcheck dedicado do worker: `python backend/scripts/webhook_worker_healthcheck.py`
- Plano de execucao QA + Arquitetura (2 sprints): `docs/sprint-plan-qa-architecture.md`

## Rotacao de chaves (Fernet)

- Guia operacional: `docs/key_rotation.md`
- Re-encriptacao assistida: `python backend/scripts/reencrypt_secrets.py --apply`
- Politica recomendada: rotacao periodica com janela curta de keyring (`WEBHOOK_SECRET_ENC_KEY_PREV`) + remocao da chave antiga apos re-encriptacao validada.

Executar dashboard SQL no compose local:

```powershell
Get-Content backend/scripts/sql/webhook_outbox_dashboard.sql | docker compose exec -T db psql -U postgres -d study_leveling -f -
```

## Windows helpers

- `dev_local.bat start|stop|status|open` (Vite + API local)
- `cmd8.bat start|stop|logs|resetdb|open|docs` (Docker fullstack)

## Deploy

- `Dockerfile` da raiz (multi-stage fullstack)
- `render.yaml` aponta para o `Dockerfile` da raiz (servico web + worker dedicado)

Mais detalhes: `DEPLOYMENT.md` e `CHECKLIST_RELEASE.md`.

Attribution dos assets: `docs/assets-attribution.md`.
