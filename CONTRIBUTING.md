# Contributing — Study Leveling (CMD8)

Obrigado por querer contribuir! Este guia explica como configurar o ambiente e seguir as convenções do projeto.

---

## Setup Local

### Pré-requisitos

- **Python 3.11+** e `pip`
- **Node.js 20+** e `pnpm` (habilitado via `corepack enable`)
- **Docker** (opcional, para rodar com container)

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate    # Windows
pip install -r requirements.txt -r requirements-dev.txt
```

### Frontend

```bash
pnpm install
```

### Variáveis de Ambiente

Crie um `.env` na raiz do `backend/`:

```env
JWT_SECRET=uma-chave-secreta-longa
DATABASE_URL=sqlite:///./dev.db
ENV=development
AUTO_CREATE_DB=true
```

### Rodando

```bash
# Backend (com hot reload)
cd backend && uvicorn app.main:app --reload --port 8000

# Frontend (com hot reload)
pnpm dev
```

---

## Convenções de Código

### Backend

- **Formatter**: `black` (line-length 100)
- **Linter**: `ruff`
- **Type checker**: `mypy` (modo estrito não obrigatório)
- **Testes**: `pytest` com `httpx.TestClient`

### Frontend

- **TypeScript** required
- **Tailwind CSS** v3
- **Linting**: ESLint via `pnpm lint:frontend`
- **Typecheck**: `pnpm typecheck`

### Commits

Use mensagens descritivas em inglês:

```
feat: add bootstrap endpoint
fix: correct streak calculation edge case
refactor: split models.py into domain modules
test: add coverage for webhook retry logic
docs: update CONTRIBUTING.md
```

---

## Rodando Testes

```bash
# Backend
cd backend && python -m pytest -q --tb=short

# Frontend lint + typecheck
pnpm lint:frontend
pnpm typecheck

# E2E (requer backend rodando)
pnpm test:e2e
```

---

## Estrutura do Projeto

```
CMD8/
├── backend/
│   ├── app/
│   │   ├── api/v1/          # Rotas da API
│   │   ├── core/            # Config, deps, security
│   │   ├── models/          # SQLModel models (por domínio)
│   │   ├── schemas/         # Pydantic schemas (por domínio)
│   │   ├── services/        # Business logic
│   │   └── workers/         # Background workers
│   ├── tests/               # Backend tests
│   └── alembic/             # DB migrations
├── client/
│   └── src/
│       ├── pages/           # Páginas principais
│       ├── components/      # Componentes reutilizáveis
│       ├── hooks/           # Custom React hooks
│       └── lib/             # Utilidades
└── .github/workflows/       # CI/CD
```

---

## Criando um PR

1. Crie um branch: `git checkout -b feat/nome-da-feature`
2. Faça suas alterações
3. Rode os testes localmente
4. Commit e push
5. Abra um Pull Request com descrição clara
