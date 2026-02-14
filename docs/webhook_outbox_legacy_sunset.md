# Webhook Legacy Path Sunset (Future Release)

Objetivo: remover envio in-process via `BackgroundTasks` apos estabilizacao do outbox+worker.

## Estado atual

- Caminho legado ainda existe quando:
  - `WEBHOOK_OUTBOX_ENABLED=false`, ou
  - `WEBHOOK_OUTBOX_ENABLED=true` e `WEBHOOK_OUTBOX_SEND_ENABLED=false` (shadow)
- Caminho novo oficial:
  - `WEBHOOK_OUTBOX_ENABLED=true`
  - `WEBHOOK_OUTBOX_SEND_ENABLED=true`
  - worker dedicado ativo

## Criterios para iniciar remoção

1. 2+ ciclos de release sem incidentes de entrega.
2. `dead` e `retry` dentro de baseline definido pelo time.
3. Runbook de requeue/cleanup validado em producao.
4. Alertas/metricas de outbox ativas e acompanhadas.

## Escopo da futura PR de remoção

1. `backend/app/services/webhooks.py`
   - remover `_legacy_enqueue(...)`
   - simplificar `enqueue_event(...)` para sempre enfileirar em outbox
2. `backend/app/api/v1/*` (sessions/drills/webhooks)
   - manter assinatura atual se ainda util
   - garantir sem dependencia funcional de `BackgroundTasks`
3. config/documentacao
   - remover `WEBHOOK_OUTBOX_SEND_ENABLED`
   - opcional manter `WEBHOOK_OUTBOX_ENABLED` apenas como kill-switch temporario
4. testes
   - remover cenarios exclusivos do legado
   - manter/expandir cenarios de worker outbox

## Ordem sugerida de PRs

1. PR A: marcar legado como deprecated em docs/changelog.
2. PR B: remover chamadas legadas e simplificar `enqueue_event`.
3. PR C: limpar flags obsoletas e testes obsoletos.

## Rollback da remocao

1. Reintroduzir branch/tag anterior com caminho legado.
2. Manter schema outbox (nao precisa rollback de migration).
3. Reativar worker e flags conforme release estavel anterior.
