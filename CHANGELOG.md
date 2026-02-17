# Changelog

All notable changes to this project will be documented in this file.

## [Não lançado]

## [1.0.0] - 2026-02-17

### Segurança
- **Criptografia Fernet para `gemini_api_key`** - Chaves de API armazenadas criptografadas em repouso usando o mesmo sistema Fernet que os segredos de webhook (`secrets.py`)
- **Mascaramento de chave de API nas respostas** - `/me/state` e `PATCH /me/settings` agora retornam chaves mascaradas (ex: `AIza****abcd`) em vez de texto simples
- **Controles de abuso de IA reforçados** - usuários autenticados agora têm limites dedicados de burst + cota diária, além dos controles existentes de convidado/IP
- **CSRF baseline verificado em testes** - requisições de mutação com autenticação por cookie sem `X-CSRF-Token` agora são explicitamente cobertas pelos testes de backend
- **CSP e headers de segurança verificados em testes** - testes de backend agora validam `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy` e `Permissions-Policy`
- **CSP reforçada para same-origin** - scripts/estilos inline são bloqueados via `script-src-attr 'none'` e `style-src-attr 'none'`

### Adicionado
- **Relatório de Web Vitals** - frontend coleta CLS/INP/LCP via biblioteca `web-vitals` e envia para `/api/v1/reports/web-vitals` usando `sendBeacon`
- **Página 404 temática** - Página "Portal Corrompido" para rotas desconhecidas em vez de redirecionamento silencioso
- **Link pular para o conteúdo** - navegação acessível por teclado no `AppShell`
- **Schema.org JSON-LD** - dados estruturados (`WebApplication`) injetados em tempo de execução pelo código frontend (sem script inline no HTML)
- **Manifesto PWA** - `manifest.webmanifest` com metadados do app e ícones
- **Arquivos de SEO** - `robots.txt`, `sitemap.xml`, URL canônica, `og:image`, meta tags de Twitter Card
- **Análise de tamanho do bundle** - `rollup-plugin-visualizer` (rodar com `$env:ANALYZE="true"; pnpm build:client`)
- **Verificação de saúde aprimorada** - `/api/v1/health` agora verifica conectividade com DB e Redis, retorna `503` em caso de falha
- **Referências estáveis de conclusão de vídeo (v2)** - página de arquivos agora resolve um id de deduplicação estável (`v2:sha256` com fallback de metadados) antes de conceder XP
- **Proteção de deduplicação no lado do servidor para `video_lesson`** - refs duplicados `video_completion::` retornam `200` com `xpEarned=0` e `goldEarned=0`
- **Testes para limites de usuário de IA** - adicionada cobertura para cota diária por usuário e limitação de burst por usuário
- **Healthcheck do worker via heartbeat** - adicionado arquivo de heartbeat + script dedicado (`backend/scripts/webhook_worker_healthcheck.py`) para saúde separada do worker
- **Runbook de rotação de chaves + ferramentas** - adicionado `docs/key_rotation.md` e `backend/scripts/reencrypt_secrets.py`

### Alterado
- **Migração de SDK** - `google-generativeai` para `google-genai` (API baseada em `Client`) em `ai.py`, `mission_generator.py`, `generate_mission_pool.py`
- **Notificações Toast** - `alert()` nativo substituído por `useToast()` em `SettingsPage`
- **Google Fonts** - adicionado link CSS com `display=swap` para prevenir FOIT
- **Superfície de configuração de cota de IA** - introduzido `AI_USER_DAILY_MAX` e `AI_USER_DAILY_WINDOW_SEC` para cotas de usuários autenticados
- **Payloads de log estruturados** - logger agora serializa todos os campos `extra` (worker_id/outbox_id/correlation_id etc.) em vez de descartar a maioria dos dados contextuais
- **Keyring de descriptografia de segredos** - descriptografia agora aceita `WEBHOOK_SECRET_ENC_KEY_PREV` durante rotação faseada de chaves

### Melhorado
- **Acessibilidade** - Atributos ARIA em toggles (`role="switch"`, `aria-checked`), anel global `focus-visible`, tamanho mínimo da fonte aumentado para 11px
- **`requirements.txt`** - atualizado para `google-genai>=1.0.0`
- **Métrica de observabilidade de cota** - adicionado `ai_rate_limited_total{scope=...}` para uso de cota de burst/diária de convidado/usuário
