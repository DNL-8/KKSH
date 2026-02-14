FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    bash \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY app /app/app
COPY alembic.ini /app/alembic.ini
COPY alembic /app/alembic
COPY entrypoint.sh /app/entrypoint.sh

# Ensure entrypoint is executable and has LF endings
RUN chmod +x /app/entrypoint.sh && sed -i 's/\r$//' /app/entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
