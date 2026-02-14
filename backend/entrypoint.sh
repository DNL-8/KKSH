#!/usr/bin/env bash
set -euo pipefail

# Run migrations (idempotent)
ALEMBIC_CONFIG="${ALEMBIC_CONFIG:-alembic.ini}"
ALEMBIC_MAX_RETRIES="${ALEMBIC_MAX_RETRIES:-30}"
ALEMBIC_RETRY_INTERVAL_SEC="${ALEMBIC_RETRY_INTERVAL_SEC:-2}"

if command -v alembic >/dev/null 2>&1; then
  if [[ -f "$ALEMBIC_CONFIG" ]]; then
    echo "Running migrations..."
    success=0
    for i in $(seq 1 "$ALEMBIC_MAX_RETRIES"); do
      if alembic -c "$ALEMBIC_CONFIG" upgrade head; then
        success=1
        break
      fi
      echo "Migration attempt $i/$ALEMBIC_MAX_RETRIES failed; retrying in ${ALEMBIC_RETRY_INTERVAL_SEC}s..."
      sleep "$ALEMBIC_RETRY_INTERVAL_SEC"
    done
    if [[ "$success" -ne 1 ]]; then
      echo "Migrations failed after $ALEMBIC_MAX_RETRIES attempts."
      exit 1
    fi
  else
    echo "Skipping migrations (missing $ALEMBIC_CONFIG)"
  fi
fi

exec "$@"
