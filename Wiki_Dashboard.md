# 📊 Dashboard de Arquitetura e Fluxo

Bem-vindo ao Dashboard estrutural do sistema. Abaixo você encontra os gráficos diagramados que explicam como os dados fluem na plataforma KKSH.

## 1. Topologia do Sistema (Visão Geral)

```mermaid
graph TD
    classDef frontend fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:#fff;
    classDef backend fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff;
    classDef database fill:#f59e0b,stroke:#b45309,stroke-width:2px,color:#fff;
    classDef external fill:#8b5cf6,stroke:#5b21b6,stroke-width:2px,color:#fff;

    User([Usuário]) -->|Acessa App| React[Frontend React/Vite]:::frontend
    
    React -->|REST API / HTTPS| FastAPI[Backend FastAPI]:::backend
    FastAPI -->|Queries SQL| DB[(PostgreSQL / SQLite)]:::database
    FastAPI -->|Prompts| Gemini[Google Gemini SDK]:::external
    
    FastAPI -->|Agendamentos| APS[APScheduler / Cron]:::backend
    APS -->|Retenção & Webhooks| DB
```

<br>

## 2. Fluxo do Sistema Gamificado (Ledger & XP)

```mermaid
sequenceDiagram
    participant U as Usuário
    participant UI as React UI
    participant B as FastAPI
    participant L as Ledger (Eventos)
    participant S as Stats (Nível)

    U->>UI: Conclui Tarefa (Estudo)
    UI->>B: POST /api/v1/events (Payload: XP)
    
    rect rgb(240, 240, 240)
        Note right of B: Validações Rígidas
        B->>B: Check Idempotency Key
        B->>B: Validate maxAgeDays
    end

    B->>L: Append row (Registro Imutável)
    L-->>B: Success
    
    B->>S: Atualiza Totais de XP e Nível do Usuário
    S-->>B: Success
    
    B-->>UI: 200 OK (Novos Status)
    UI-->>U: Animação de Level Up 🚀!
```

<br>

## 3. Arquitetura de Proteção e Segurança (Defesa em Profundidade)

```mermaid
flowchart LR
    Request[Incoming Request] --> Rate[Rate Limiter]
    
    Rate -->|Válido| CSRF[CSRF Middleware]
    Rate -->|Excedido| E1[429 Too Many Requests]
    
    CSRF -->|Token Válido| Auth[Auth Token Validation]
    CSRF -->|Inválido| E2[403 Forbidden]
    
    Auth -->|Token Assinado| Route[API Route Executada]
    Auth -->|Expirado/Ausente| E3[401 Unauthorized]
    
    Route --> DB[(Banco de Dados)]
```

<br>

*Você pode copiar e colar o conteúdo raw (Markdown) dessse arquivo diretamente nas páginas da Wiki do repositório no GitHub para renderizar esses gráficos dinamicamente!*
