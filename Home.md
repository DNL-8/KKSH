# Bem-vindo à Wiki do Projeto KKSH 🚀

Este é o portal principal de documentação técnica do sistema **KKSH** — uma plataforma avançada de estudos e gamificação, potencializada por IA (Gemini) e construída em uma arquitetura robusta de ponta a ponta.

---

## 🏗️ Visão Geral da Arquitetura

O projeto é dividido em dois serviços principais e altamente independentes:

### 1. Frontend (Interface do Usuário)
A experiência do usuário foi reescrita e desenhada para ser limpa, responsiva e performática (Glassmorphism design language).
- **Frameworks:** React, Vite, TypeScript
- **Estilos:** Vanilla CSS / Design Variables (Theming Customizável com Modo Escuro Nativo)
- **Gerenciador de Pacotes:** `pnpm`
- **Funcionalidades Chave:** Dashboards assíncronos, navegação premium, proteção CSRF transparente e interceptadores de token instanciados globalmente.

### 2. Backend (Motor Lógico e API)
O núcleo forte do sistema. Responsável pela persistência, validação rígida, segurança, e orquestração dos serviços de Inteligência Artificial.
- **Framework:** FastAPI (Python)
- **Banco de Dados:** SQLite/PostgreSQL configurados via SQLAlchemy (ORM híbrido)
- **Integração IA:** Google Gemini SDK Pro/Flash
- **Gerenciador de Pacotes:** `pip`
- **Funcionalidades Chave:** 
  - Livro-Razão (Ledger) de XP e Sistema de Recompensas imutável e idempotente.
  - Segurança enterprise-grade (Rate Limits severos, Prevenção SSRF, CSRF via double-submit cookies, pip-audit strict mode).
  - Webhooks assíncronos via APScheduler.

---

## 🛠️ Começando (Getting Started)

Se você é um novo desenvolvedor ou engenheiro procurando configurar o projeto localmente, siga estes guias:

1. **Configuração Local:** Clone o repositório, instale o Python e Node.js em suas máquinas e rode os setups. (Certifique-se de configurar o arquivo `.env` para apontar ao seu IP local ou `localhost`, e adicionar a `GEMINI_API_KEY`).
2. **Scripts Principais:**
   - **Backend:** `venv/scripts/activate` -> `fastapi dev app/main.py`
   - **Frontend:** `pnpm i` -> `pnpm run dev`
   - **Testes (TDD):** Usamos o `pytest` para rodar a esteira com mais de 70 testes garantindo `status_code 200` absolutos.
3. Para consultar o dicionário detalhado de Endpoints, visite a rota gerada pelo backend local em `/docs` ou `/redoc` em tempo de execução.

---

## 📚 Índice da Wiki (Para ser construído futuramente)

Recomendamos a leitura dos seguintes módulos de negócio para um entendimento aprofundado do projeto KKSH, conforme ele for sendo documentado aqui na Wiki:

- [ ] Arquitetura do Livro-Razão de Eventos (Idempotência e XP)
- [ ] O Sistema de Gamificação (Missões e Rewards)
- [ ] O Motor de AI (Integração Gemini, Quota API key Fallback)
- [ ] Fluxo de Segurança e Proteção (Tokens, SSRF e Cookies Seguros)
- [ ] Como Contribuir (Guidelines para CI e Pull Requests)

---

> A documentação técnica reflete o código mais recente hospedado na branch principal devidamente protegida pelos *CI Checks* modernos implementados a partir de 2026.
