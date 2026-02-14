# Checklist de melhorias (80)

> ✅ = já feito no repositório  
> ⬜ = próximo passo / pendente

## Progresso (agora)
- UX/UI (Mobile + Web): ✅ 15 / ⬜ 0
- PWA / Offline: ✅ 5 / ⬜ 0
- Backend / API: ✅ 20 / ⬜ 0
- Banco / Dados: ✅ 6 / ⬜ 0

## UX/UI (Mobile + Web)
1. ✅ Layout mobile-first (safe areas, bottom-nav, topbar)
2. ✅ Rotas principais: Today / Study / Reviews / Progress / Profile
3. ✅ Navegação persistente (BottomNav + active state)
4. ✅ Tela “Onboarding” (1–2 min) para configurar metas e rotina
5. ✅ “Quick add” de sessão (botão flutuante) — implementado na tela Study (B)
6. ✅ Histórico de sessões com filtros (data/assunto/modo)
7. ✅ Página de detalhes da sessão (editar/excluir)
8. ✅ Componentes skeleton + estados vazios consistentes
9. ✅ Tema dark/light + preferência do sistema
10. ✅ Acessibilidade: foco, aria-labels, contraste AA
11. ✅ Feedback haptics no mobile (quando disponível)
12. ✅ Notificações in-app (toasts) padronizadas
13. ✅ “Streak” e metas com visual mais gamificado (progress ring)
14. ✅ Tela de “Configurações” (XP/Gold, metas, lembretes, backup, idioma)
15. ✅ Internacionalização (pt/en)

## PWA / Offline
16. ✅ Manifest + Service Worker (installable)
17. ✅ Ícones e meta tags PWA
18. ✅ Offline-first para telas principais (cache local de GET + app shell PWA)
19. ✅ Background sync (outbox local + flush automático quando voltar online)
20. ✅ Lembretes locais (Notification API/toast) enquanto o app está aberto (sem push)

## Backend / API (FastAPI)
21. ✅ Auth com cookies httpOnly (signup/login/refresh/logout)
22. ✅ Postgres (docker-compose) + SQLModel
23. ✅ Quests diárias + metas (study plan)
24. ✅ Sessões de estudo + relatório semanal
25. ✅ Revisão espaçada (SM-2 simplificado) + fila de revisões
26. ✅ Healthcheck `/api/v1/health`
27. ✅ Rate limiting (in-memory) em auth (signup/login/refresh)
28. ✅ Logs estruturados (JSON) + `X-Request-ID`
29. ✅ Testes (pytest) cobrindo auth/sessões/quests/reviews
30. ✅ CI (GitHub Actions) com build do front + testes do backend
31. ✅ Alembic migrations (init) + entrypoint com `alembic upgrade head`
32. ✅ Versionamento da API (e.g. `/api/v1`) — expandir padrão de respostas/erros
33. ✅ Padronizar erro em JSON (`{code, message, details}`) sem quebrar o front
34. ✅ Pagination real + cursores para endpoints de listas
35. ✅ Endpoint de export/import (backup do usuário)
36. ✅ CRUD de “Drills” no backend (banco) em vez de só no front
37. ✅ CRUD de “Subjects” (assuntos) customizáveis por usuário
38. ✅ Sistema de XP/nível no backend (fonte da verdade)
39. ✅ Endpoint de “Achievements” (badges)
40. ✅ Webhooks / integrações (ex: Notion) (opcional)

## Banco / Dados
41. ✅ Índices básicos (email, user_id, subject, date_key, drill_id)
42. ✅ Constraints/FKs (user_id → users.id) e ON DELETE CASCADE
43. ✅ “Soft delete” em sessões (deleted_at)
44. ✅ Retenção/limpeza: job para expirar refresh tokens (se persistidos)
45. ✅ Views/queries para relatórios mais ricos (por mês, por meta)
46. ✅ Migrations autogeradas + política de versionamento (sem “drift”)

## Observabilidade / Segurança
47. ✅ Request ID + logs por request
48. ✅ Métricas (Prometheus) + endpoint `/metrics`
49. ✅ Sentry (ou equivalente) para erros
50. ✅ Auditoria (log de eventos: login, refresh, create_session, claim_quest)
51. ✅ CORS hardening + lista por ambiente
52. ✅ Cookie hardening (SameSite/secure por ambiente, domínio)
53. ✅ CSRF protection (double-submit cookie ou header)
54. ✅ Rate limiting com Redis (produção multi-instância)

## Qualidade / DX
55. ✅ Scripts e documentação de execução
56. ✅ Dockerfile/compose ajustados para migrations
57. ✅ Lint/format (ruff/black) + pre-commit
58. ✅ Typecheck (mypy) no backend
59. ✅ Testes E2E do front (Playwright)
60. ✅ Seed de dados para dev (conta demo, drills demo)
61. ⬜ Monorepo tooling (turbo/nx) (opcional)

## Gamificação / Estudo (Produto)
62. ✅ Streak básico no backend (via sessões/dias)
63. ✅ XP por sessão + bônus por quests (bônus por meta: pendente)
64. ✅ Sistema de “rank”/nível e progressão visual
65. ✅ Quests semanais (além das diárias)
66. ✅ Revisões com “modo treino”: timer, embaralhar, difficulty
67. ✅ Estatísticas de revisão (acerto, tempo, maturidade)
68. ✅ “Plano de estudo” com calendário (blocos/agenda)
69. ✅ Recomendações: “o que estudar agora” (baseado em metas + reviews)
70. ✅ Biblioteca de drills por trilhas (SQL, Python, Excel)

## Mobile polish
71. ✅ Layout tipo app (safe areas, PWA)
72. ✅ Gestos: swipe entre tabs (opcional)
73. ✅ Otimizar fontes e espaçamentos para telas pequenas
74. ✅ Largura máxima e grid melhor no desktop

## Deploy
75. ⬜ Deploy do backend (Railway/Fly/Render) + Postgres gerenciado
76. ⬜ Deploy do front (Vercel/Netlify) + envs
77. ⬜ HTTPS e domínio (necessário pra PWA e cookies secure)
78. ⬜ Backup automático do banco (cron)
79. ⬜ Documentação pública (OpenAPI + exemplos de requests)
80. ⬜ Pipeline de release (tags/semver/changelog)
