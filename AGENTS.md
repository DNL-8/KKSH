# AGENTS.md - Contrato Oficial de Geracao de Missoes IA

## Objetivo
Padronizar como agentes e backend geram missoes oficiais (`daily` e `weekly`) para o CMD8.
O foco e entregar missoes operacionais claras, com estilo Solo Leveling, sem quebrar progresso existente.

## Escopo de aplicacao
- Endpoint oficial: `POST /api/v1/missions/regenerate`.
- Ciclos oficiais: `daily`, `weekly`, `both`.
- Consumidores primarios: `Today` e `Hub`.

## Referencia complementar
Consulte `docs/mission-generation-contract.md` para exemplos validos/invalidos e tabela detalhada de campos.

## Schema de saida obrigatorio
Geracao IA deve retornar JSON com:
- `daily`: lista de 5 objetos.
- `weekly`: lista de 5 objetos.
- Cada objeto com campos: `subject`, `title`, `description`, `targetMinutes`, `rank`, `difficulty`, `objective`, `tags`.

## Validacoes obrigatorias
1. Exatamente 5 missoes por ciclo solicitado.
2. Sem `subject` duplicado dentro do mesmo ciclo.
3. `rank` em `F|E|D|C|B|A|S`.
4. `difficulty` em `easy|medium|hard|elite`.
5. `targetMinutes` saneado por ciclo:
   - `daily`: 10..180
   - `weekly`: 60..1200
6. `tags` normalizadas (slug simples, sem duplicidade, max 6).

## Politica de fallback
1. Se Gemini estiver indisponivel, invalido ou incompleto, aplicar fallback local deterministico.
2. Se IA vier parcial/duplicada, complementar com fallback mantendo 5 itens.
3. `source` final por geracao:
   - `gemini`: 100% IA valida
   - `fallback`: 100% fallback
   - `mixed`: IA + fallback

## Regras de sobrescrita oficial
1. Regeneracao sobrescreve quests oficiais do ciclo alvo.
2. Sobrescrita nunca e anonima: usuario autenticado obrigatorio.
3. Cooldown por usuario: `AI_MISSION_REGEN_COOLDOWN_SEC`.

## Migracao de progresso
1. Sempre migrar progresso e claim da base antiga para a nova.
2. Matching por prioridade:
   - match exato de `subject` normalizado
   - bucket semantico (alias)
   - similaridade textual
3. Se `claimed=true` em origem mapeada, destino deve ficar `claimed=true` e `progress=target`.
4. Progresso nunca ultrapassa `targetMinutes` do destino.

## Formula de recompensa
Recompensa de claim e dinamica por `rank + difficulty + cycle`:
- Persistir em `reward_xp` e `reward_gold` por quest.
- Claims usam valores persistidos.
- Fallback legado:
  - daily: `50 XP / 25 Gold`
  - weekly: `200 XP / 100 Gold`

## Qualidade e seguranca
1. Chave Gemini nunca no frontend.
2. Endpoint protegido por auth + CSRF.
3. Log de auditoria obrigatorio em `missions.regenerate` com `reason`, `source`, `durationMs`, contagens.
4. PT-BR como lingua primaria dos textos gerados.

## Checklist minimo de testes
1. Regeneracao gera 5+5 e sem duplicata de `subject` por ciclo.
2. Cooldown de 1h retorna `429 rate_limited` com `scope=ai_mission_regen`.
3. Sobrescrita preserva progresso/claim.
4. Claim aplica recompensa dinamica persistida.
5. Fallback local funciona sem `GEMINI_API_KEY`.
6. `Today` e `Hub` exibem origem (`gemini/fallback/mixed`) sem regressao de navegacao.
