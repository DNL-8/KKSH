# Study Leveling (Fullstack)

Aplicacao fullstack com backend FastAPI e frontend React + Vite + Tailwind, servida em same-origin em producao.

## Stack

- Backend: FastAPI + SQLModel + Alembic
- Frontend: React + TypeScript + Vite + Tailwind v3
- Banco: Postgres (Docker) / SQLite (local)
- Cache/rate limiting compartilhado: Redis
- E2E: Playwright

## Rotas web

- `/hub`
- `/combate`
- `/revisoes`
- `/arquivos`
- `/evolucao`
- `/ia`
- `/config`
- `/` redireciona para `/hub`

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
- `WEBHOOK_DELIVERY_TIMEOUT_SEC` timeout de entrega HTTP por webhook

## Hardening de producao

- `AUTO_CREATE_DB=false`
- `SEED_DEV_DATA=false`
- `PERSIST_REFRESH_TOKENS=true`
- `JWT_SECRET` forte (>=32)
- `WEBHOOK_SECRET_ENC_KEY` definido
- `CORS_ORIGINS` vazio para same-origin (ou lista explicita para cross-origin)

## Scripts uteis

- `pnpm dev:client`
- `pnpm dev:api`
- `pnpm dev:all`
- `pnpm build`
- `pnpm e2e`
- `pnpm check`
- `PYTHONPATH=. python backend/scripts/run_webhook_worker.py --once`
- `PYTHONPATH=. python backend/scripts/requeue_webhook_outbox.py --all-dead --limit 100`
- `PYTHONPATH=. python backend/scripts/cleanup_webhook_outbox.py --sent-days 14 --shadow-days 7 --dead-days 30`

## Runbooks webhook outbox

- Rollout gradual: `docs/webhook_outbox_rollout.md`
- Sunset do caminho legado (release futura): `docs/webhook_outbox_legacy_sunset.md`
- Dashboard SQL (Postgres): `backend/scripts/sql/webhook_outbox_dashboard.sql`

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
