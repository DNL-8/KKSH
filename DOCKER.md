# Guia de Docker para Desenvolvimento Local

Este projeto utiliza Docker para criar um ambiente de desenvolvimento consistente, replicando a stack de produção (Frontend + Backend + Banco de Dados + Redis).

## Pré-requisitos

- Docker Desktop instalado e rodando.
- Git.

## Comandos Principais

### Iniciar o Ambiente

Para subir todos os serviços (Frontend, API, Banco de Dados, Redis, Worker):

```bash
docker-compose up --build
```
Isso irá construir as imagens e iniciar os containers em modo 'anexado' (logs no terminal). Adicione `-d` para rodar em segundo plano.

### Verificar Status

```bash
docker-compose ps
```

### Parar o Ambiente

```bash
docker-compose down
```
Para parar e remover volumes (resetar banco de dados):
```bash
docker-compose down -v
```

## Estrutura dos Serviços

| Serviço | Porta Interna | Porta Exposta | Descrição |
|---|---|---|---|
| `api` | 8000 | 8000 | Backend FastAPI. Serve também o Frontend estático em produção/docker. |
| `db` | 5432 | 5432 | Postgres 16 (Local). Em produção usa-se Turso (LibSQL). |
| `redis` | 6379 | 6379 | Cache e filas de tarefas. |
| `webhook_worker` | N/A | N/A | Processador de filas de background. |

## Detalhes de Configuração

### Desenvolvimento Local vs Produção

- **Banco de Dados**: Localmente usamos Postgres pela robustez e facilidade com Docker. Em produção usamos Turso (SQLite distribuído). O ORM (SQLAlchemy) abstrai essa diferença, mas evite usar tipos específicos de banco (ex: JSONB do Postgres, Array) sem cuidado.
- **Frontend**: No desenvolvimento local (`pnpm dev`), o Vite roda um servidor separado na porta 3000. No Docker, o frontend é "buildado" e servido pelo FastAPI como arquivos estáticos, simulando o deploy final.
