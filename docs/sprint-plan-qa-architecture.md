# Sprint Plan (QA + Arquitetura)

Plano executavel em 2 sprints, focado em risco primeiro e depois escala/manutenibilidade.

## Sprint 1 (2 semanas) - Estabilidade e Seguranca

### 1) Refresh token com `jti` (P0)

- Objetivo: impedir colisao de refresh token emitido no mesmo segundo.
- Arquivos:
  - `backend/app/core/security.py`
  - `backend/app/api/v1/auth.py`
  - `backend/tests/test_auth.py`
- Implementacao:
  - Adicionar claim `jti` (UUID) em `create_token(...)`.
  - Manter `sub`, `type`, `iat`, `exp` como hoje.
  - Em `refresh`, validar presenca de `jti` para tokens novos.
  - Preservar compatibilidade de leitura para tokens antigos (sem `jti`) durante transicao.
- Testes:
  - Unit: dois `create_refresh_token(...)` consecutivos devem gerar tokens diferentes.
  - Integration: fluxo `login -> refresh` nao pode falhar por conflito de token.
- Aceite:
  - Sem erro de unicidade em `refresh_tokens.token_hash`.
  - Testes verdes no CI.

### 2) Atomicidade de `sessions` (P0)

- Objetivo: evitar estado parcial em falha de meio de fluxo.
- Arquivos:
  - `backend/app/api/v1/sessions.py`
  - `backend/app/services/progression.py`
  - `backend/app/core/deps.py`
  - `backend/tests/test_sessions_quests.py`
- Implementacao:
  - Refatorar fluxo de `create/update/delete` para uma transacao de negocio com commit unico.
  - Remover commits internos de servicos chamados por esse fluxo (ou criar variantes sem commit).
  - Garantir que quest/progressao/audit/outbox participem da mesma unidade transacional.
- Testes:
  - Integration: simular excecao apos gravar sessao e antes do final; confirmar rollback total.
  - Integration: `create/update/delete` continuam com mesmo contrato HTTP.
- Aceite:
  - Nenhum estado parcial apos falha injetada.
  - Regressao de sessoes e quests continua verde.

### 3) Resiliencia do worker de webhooks (P1)

- Objetivo: worker nao cair por falha transiente.
- Arquivos:
  - `backend/app/workers/webhook_outbox_worker.py`
  - `backend/tests/test_webhook_outbox.py`
- Implementacao:
  - Envolver loop de `run_forever(...)` com `try/except` global.
  - Em excecao, logar evento estruturado e seguir loop apos pequeno delay.
  - Preservar comportamento atual de `process_once(...)`.
- Testes:
  - Unit/integration: falha em um ciclo nao encerra processo.
- Aceite:
  - Worker continua vivo sob erro transiente.
  - Logs com contexto de erro disponiveis.

### 4) Menu mobile funcional (P1)

- Objetivo: abrir navegação lateral em mobile.
- Arquivos:
  - `client/src/layout/AppShell.tsx`
  - `e2e/smoke.spec.ts`
- Implementacao:
  - Adicionar botao hamburger no header mobile chamando `setIsMobileMenuOpen(true)`.
  - Garantir fechamento por clique externo e por navegacao.
- Testes:
  - E2E mobile: abrir menu, navegar e fechar.
- Aceite:
  - Navegacao mobile operacional sem regressao desktop.

### 5) Correcao de encoding quebrado (P1)

- Objetivo: remover texto corrompido na UI.
- Arquivos:
  - `client/src/layout/AppShell.tsx`
  - `client/src/pages/HubPage.tsx`
  - `client/src/pages/CombatPage.tsx`
- Implementacao:
  - Substituir trechos com mojibake por texto valido.
  - Preferir strings ASCII simples para evitar regressao de encoding local.
- Testes:
  - Smoke visual rapido em `/hub` e `/combate`.
- Aceite:
  - Sem texto corrompido visivel.

### 6) Cobertura de regressao para itens P0/P1 (P1)

- Objetivo: congelar regressao dos fixes.
- Arquivos:
  - `backend/tests/test_auth.py`
  - `backend/tests/test_sessions_quests.py`
  - `backend/tests/test_webhook_outbox.py`
  - `e2e/smoke.spec.ts`
- Implementacao:
  - Adicionar cenarios especificos de cada bug corrigido.
- Aceite:
  - Todos os cenarios novos passam local e no CI.

## Sprint 2 (2 semanas) - Performance e Escala

### 1) Indice para paginacao de sessoes (P1)

- Objetivo: reduzir latencia de listagem com cursor.
- Arquivos:
  - `backend/alembic/versions/<new_revision>_sessions_pagination_index.py`
  - `backend/app/api/v1/sessions.py`
  - `backend/tests/test_sessions_quests.py`
- Implementacao:
  - Criar indice composto para padrao de consulta:
    - filtro: `user_id`, `deleted_at`
    - ordenacao: `created_at desc`, `id desc`
  - Manter compatibilidade SQLite/Postgres na migracao.
- Testes:
  - Regressao funcional de paginacao.
- Aceite:
  - Consulta de listagem usa indice em explain (Postgres).

### 2) Bootstrap unico do AppShell (P1)

- Objetivo: reduzir round-trip no boot do frontend.
- Arquivos:
  - `backend/app/api/v1/me.py`
  - `backend/app/schemas.py`
  - `client/src/lib/api.ts`
  - `client/src/layout/AppShell.tsx`
  - `backend/tests/test_me_reset.py`
- Implementacao:
  - Criar endpoint unico (ex.: `/api/v1/me/bootstrap`) com payload necessario para header/HUD.
  - Trocar `getMe() + getMeState()` por uma chamada unica no frontend.
- Testes:
  - Integration backend do novo endpoint.
  - Smoke frontend de boot/autenticacao.
- Aceite:
  - Boot do app com 1 request principal de estado.

### 3) Web Vitals no cliente (P2) — ✅ CONCLUÍDO

- Implementado em `client/src/lib/webVitals.ts` e `App.tsx`
- Coleta CLS, INP e LCP via `web-vitals` library
- Envia para `/api/v1/reports/web-vitals` usando `navigator.sendBeacon`

### 4) Otimizacao de custo de depth no worker (P2)

- Objetivo: reduzir custo de leitura agregada por ciclo.
- Arquivos:
  - `backend/app/workers/webhook_outbox_worker.py`
  - `backend/app/core/config.py`
  - `backend/tests/test_webhook_outbox.py`
- Implementacao:
  - Atualizar gauge de depth somente:
    - a cada N ciclos, ou
    - quando houver mudanca de estado.
  - Tornar intervalo configuravel.
- Testes:
  - Confirmar atualizacao de metricas sem query agregada em todo ciclo.
- Aceite:
  - Menos carga de DB em idle mantendo observabilidade util.

### 5) Modularizacao fase 1 de `FilesPage` (P2)

- Objetivo: reduzir acoplamento e facilitar manutencao.
- Arquivos:
  - `client/src/pages/FilesPage.tsx`
  - `client/src/components/files/*`
  - `client/src/lib/localVideosStore.ts`
  - `e2e/files.local-videos.spec.ts`
  - `e2e/files.rpg-progress.spec.ts`
- Implementacao:
  - Extrair blocos para hooks/componentes:
    - importacao/storage
    - player + metadados
    - trilha lateral
    - conclusao RPG
- Testes:
  - Manter e2e atual verde.
- Aceite:
  - `FilesPage.tsx` reduzido com comportamento preservado.

### 6) Gate de cobertura no CI (P3)

- Objetivo: aumentar confiabilidade do merge.
- Arquivos:
  - `backend/requirements-dev.txt`
  - `.github/workflows/ci.yml`
  - `pytest.ini`
- Implementacao:
  - Adicionar `pytest-cov`.
  - Publicar cobertura de backend e definir threshold inicial conservador.
- Testes:
  - CI deve falhar abaixo do threshold.
- Aceite:
  - Cobertura visivel e regra aplicada no pipeline.

## Sequencia recomendada de execucao

1. Sprint 1: itens 1, 2 e 3.
2. Sprint 1: itens 4 e 5.
3. Sprint 1: item 6.
4. Sprint 2: itens 1 e 2.
5. Sprint 2: itens 3 e 4.
6. Sprint 2: itens 5 e 6.

## Comandos de validacao (padrao)

```bash
pnpm lint:frontend
pnpm typecheck
python -m pytest -q backend/tests
pnpm e2e
python -m pip_audit -r backend/requirements.txt
pnpm audit --prod --audit-level high
```

## Definition of Done (por item)

1. Codigo implementado no(s) arquivo(s) planejado(s).
2. Testes novos cobrindo o risco alvo.
3. CI verde.
4. Sem mudanca de contrato publico quando nao previsto.
5. Changelog/documentacao atualizados quando aplicavel.
