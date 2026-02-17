# Guia de Deploy (Stack Render + Turso + Netlify)

Este guia cobre a implantação do backend (FastAPI) no Render com banco de dados Turso (LibSQL) e o frontend (Vite/React) no Netlify.

---

## 1. Banco de Dados (Turso)

1. Crie uma conta no [Turso](https://turso.tech/).
2. Crie um novo banco de dados: `turso db create study-leveling`.
3. Obtenha a URL do banco: `turso db show study-leveling --url`.
   - Exemplo: `libsql://study-leveling-usuario.turso.io`.
4. Crie um token de autenticação: `turso db tokens create study-leveling`.
5. **String de Conexão Final** (para usar no Render):
   ```text
   sqlite+libsql://SEU-BANCO.turso.io?authToken=SEU-TOKEN
   ```

---

## 1.1 Geração de Segredos (Importante)

Para garantir a segurança em produção, gere hashes fortes para as variáveis `JWT_SECRET` e `WEBHOOK_SECRET_ENC_KEY`.

Execute no seu terminal (Linux/Mac/WSL):
```bash
openssl rand -hex 32
```
Copie a saída e use como valor para as variáveis de ambiente.

---

## 2. Backend (Render)

1. Crie uma conta no [Render](https://render.com/).
2. Clique em **New +** -> **Web Service**.
3. Conecte seu repositório GitHub.
4. Configure o serviço:
   - **Name**: `study-leveling-api`
   - **Language**: `Python 3`
   - **Branch**: `main`
   - **Root Directory**: `backend` (Importante!)
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `bash entrypoint.sh uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - *Nota: O `./entrypoint.sh` executa as migrações automaticamente antes de iniciar o app.*

5. Adicione as **Environment Variables**:
   | Variável | Valor | Descrição |
   |---|---|---|
   | `PYTHON_VERSION` | `3.11.9` | Versão do Python |
   | `DATABASE_URL` | `sqlite+libsql://...` | A string do Turso (passo 1) |
   | `JWT_SECRET` | `(gere-um-hash-longo)` | `openssl rand -hex 32` |
   | `WEBHOOK_SECRET_ENC_KEY` | `(gere-um-hash-longo)` | `openssl rand -hex 32` (Necessário!) |
   | `ENV` | `prod` | Ativa configurações de produção |
   | `CORS_ORIGINS` | `https://seusite.netlify.app` | Domínio do Frontend (adicione após o deploy do Netlify) |
   | `GEMINI_API_KEY` | `...` | Sua chave da Google AI |
   | `AI_RATE_LIMIT_MAX` | `30` | Burst de requests de IA por janela |
   | `AI_RATE_LIMIT_WINDOW_SEC` | `60` | Janela (segundos) do burst de IA |
   | `AI_USER_DAILY_MAX` | `120` | Quota diaria por usuario autenticado |
   | `AI_USER_DAILY_WINDOW_SEC` | `86400` | Janela diaria da quota por usuario |
   | `AI_GUEST_DAILY_MAX` | `10` | Quota diaria para guest (sem login) |
   | `AI_GUEST_DAILY_WINDOW_SEC` | `86400` | Janela diaria da quota guest |
   | `WEBHOOK_SECRET_ENC_KEY_PREV` | `(opcional)` | Chaves antigas (csv) para fase de rotacao |
   | `WEBHOOK_WORKER_HEARTBEAT_FILE` | `/tmp/webhook_worker_heartbeat.json` | Arquivo de heartbeat do worker |
   | `WEBHOOK_WORKER_HEARTBEAT_MAX_AGE_SEC` | `120` | Maximo de atraso aceito no heartbeat |
   | `WEBHOOK_OUTBOX_ENABLED` | `true` | Ativa processamento de webhooks |
   | `WEBHOOK_OUTBOX_SEND_ENABLED` | `true` | Ativa envio real de webhooks |
   | `DB_POOL_SIZE` | `5` | Tamanho do pool de conexões (opcional para Turso) |
   | `REDIS_URL` | `(opcional)` | Redis para rate limit compartilhado. Se omitido, usa memória local. |

6. Clique em **Create Web Service**.

7. **Verifique os Logs**:
   - Acompanhe o deploy. O comando `./entrypoint.sh` deve rodar `alembic upgrade head` e depois iniciar o Uvicorn.

---

## 3. Frontend (Netlify)

1. Crie uma conta no [Netlify](https://www.netlify.com/).
2. Clique em **Add new site** -> **Import an existing project**.
3. Conecte o GitHub e selecione o repositório.
4. Configure o build (o Netlify deve detectar automaticamente, mas confirme):
   - **Base directory**: `.` (raiz)
   - **Build command**: `npm run build`
   - **Publish directory**: `dist/public` (Confirmado no vite.config.ts)

> 💡 **Dica (Backend)**: O repositório já contém um arquivo `render.yaml`. No Render, você pode escolher **Blueprints** em vez de **Web Service** para configurar tudo automaticamente.

5. Adicione as **Environment Variables** (Site settings > Environment variables):
   | Variável | Valor | Descrição |
   |---|---|---|
   | `VITE_API_TARGET` | `https://study-leveling-api.onrender.com` | URL do seu Backend no Render |
   | `NODE_VERSION` | `20` | Versão do Node.js |

   > ⚠️ **Atenção**: O projeto usa Vite, não Next.js. A variável correta é `VITE_API_TARGET`, **não** `NEXT_PUBLIC_API_URL`.

6. Clique em **Deploy site**.

---

## 4. Pós-Deploy e Configurações Finais

1. **Atualizar CORS no Render**:
   - Copie a URL gerada pelo Netlify (ex: `https://study-leveling-front.netlify.app`).
   - Volte ao Render > Dashboard > Environment > Edit `CORS_ORIGINS`.
   - Cole a URL do Netlify (sem barra no final).

2. **Ajuste de Cookies (Crítico para Cross-Domain)**:
   - Como o Backend (Render) e Frontend (Netlify) estão em domínios diferentes, você deve configurar as variáveis de cookie no Render para permitir o envio:
   - `COOKIE_SAMESITE`: `none`
   - `COOKIE_SECURE`: `true`
   - `CSRF_ENABLED`: `true` (Mantenha ativado, o frontend envia o cabeçalho X-CSRF-Token)

3. **Verificar Conexão**:
   - Abra o site no Netlify.
   - Tente fazer Signup/Login.
   - Verifique o console do navegador (F12) se houver erros de CORS ou conexão.

4. **Backup Automático**:
   - O Turso possui backups automáticos (Point-in-Time Recovery) no plano pago, ou snapshots manuais no plano free. Recomenda-se criar um script de dump periódico se usar o plano free.
