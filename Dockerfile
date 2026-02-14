FROM node:20-alpine AS frontend-builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml* ./
COPY client ./client
COPY tsconfig.json tsconfig.node.json vite.config.ts tailwind.config.cjs postcss.config.cjs ./

RUN pnpm install --frozen-lockfile
RUN pnpm build


FROM python:3.11-slim AS runtime

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    bash \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY backend/app /app/app
COPY backend/scripts /app/scripts
COPY backend/alembic.ini /app/alembic.ini
COPY backend/alembic /app/alembic
COPY backend/entrypoint.sh /app/entrypoint.sh
COPY --from=frontend-builder /app/dist/public /app/dist/public

RUN chmod +x /app/entrypoint.sh && sed -i 's/\r$//' /app/entrypoint.sh

ENV SERVE_FRONTEND=true \
    FRONTEND_DIST_PATH=/app/dist/public

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
