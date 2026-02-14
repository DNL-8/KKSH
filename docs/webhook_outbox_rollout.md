# Webhook Outbox Rollout Runbook

Runbook para ativacao gradual do `webhook_outbox` com worker dedicado, sem downtime.

## Pre-checks

1. Confirmar migration aplicada (`20260214_0015_webhook_outbox`).
2. Confirmar servico `webhook_worker` deployado.
3. Confirmar `/api/v1/health` retornando `200`.

Comandos locais (docker compose):

```powershell
docker compose up -d --build db redis api webhook_worker
curl http://localhost:8000/api/v1/health
docker compose logs --tail=100 api
docker compose logs --tail=100 webhook_worker
```

## Fase 0 - Preparacao (sem mudanca funcional)

Objetivo: manter envio legado e preparar schema/codigo.

Flags:

- `WEBHOOK_OUTBOX_ENABLED=false`
- `WEBHOOK_OUTBOX_SEND_ENABLED=false`

Validacao:

```powershell
docker compose exec db psql -U postgres -d study_leveling -c "select count(*) as total from webhook_outbox;"
```

Esperado: tabela existe; envio segue caminho legado.

## Fase 1 - Shadow

Objetivo: gravar outbox para observabilidade, mantendo envio legado.

Flags:

- `WEBHOOK_OUTBOX_ENABLED=true`
- `WEBHOOK_OUTBOX_SEND_ENABLED=false`

Validacao:

```powershell
docker compose exec db psql -U postgres -d study_leveling -c "select status, count(*) from webhook_outbox group by status order by status;"
```

Esperado:

- crescimento de `shadow`
- sem impacto de entrega externa (continua via legacy)

## Fase 2 - Cutover para Worker

Objetivo: worker assume entrega oficial.

Flags:

- `WEBHOOK_OUTBOX_ENABLED=true`
- `WEBHOOK_OUTBOX_SEND_ENABLED=true`

Validacao operacional:

```powershell
docker compose logs --tail=200 webhook_worker
python backend/scripts/run_webhook_worker.py --once
```

Validacao de fila:

```powershell
docker compose exec db psql -U postgres -d study_leveling -c "select status, count(*) from webhook_outbox group by status order by status;"
docker compose exec db psql -U postgres -d study_leveling -c "select id, webhook_id, event, attempt_count, last_error from webhook_outbox where status='dead' order by dead_at desc limit 20;"
```

Esperado:

- novos itens entram em `pending`
- worker move para `sent`/`retry`/`dead`
- caminho legado nao envia novos eventos

## Fase 3 - Estabilizacao

Objetivo: reduzir backlog shadow e estabilizar SLO de entrega.

Comandos:

```powershell
python backend/scripts/cleanup_webhook_outbox.py --sent-days 14 --shadow-days 7 --dead-days 30
python backend/scripts/requeue_webhook_outbox.py --all-dead --limit 100
```

Monitore:

- taxa de `retry`
- crescimento de `dead`
- idade da fila `pending/retry`

## Rollback

1. Setar `WEBHOOK_OUTBOX_SEND_ENABLED=false`.
2. Se necessario, setar `WEBHOOK_OUTBOX_ENABLED=false`.
3. Reiniciar web/worker.
4. Parar worker se rollback completo.

Comandos locais:

```powershell
docker compose stop webhook_worker
docker compose up -d api
```

## Gate de promocao entre fases

1. `dead` dentro do limite aceitavel do produto.
2. sem crescimento continuo de `retry` sem drenagem.
3. sem aumento relevante de latencia API.
4. sem duplicidade de envio observada no destino.
