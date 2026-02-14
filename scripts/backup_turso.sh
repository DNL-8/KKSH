#!/bin/bash
# Script de Backup Automático para Turso
# Requer: turso CLI instalado e autenticado

DB_NAME="study-leveling"
BACKUP_DIR="./backups"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="${BACKUP_DIR}/backup_${DB_NAME}_${DATE}.sql"

mkdir -p "$BACKUP_DIR"

echo " iniciando backup de $DB_NAME para $FILENAME..."

# Dump do banco (schema + data)
turso db shell "$DB_NAME" .dump > "$FILENAME"

if [ $? -eq 0 ]; then
  echo "✅ Backup concluído com sucesso: $FILENAME"
  # Opcional: Upload para S3/GCS aqui
  # aws s3 cp "$FILENAME" s3://meu-bucket/backups/
else
  echo "❌ Erro ao realizar backup"
  exit 1
fi

# Manter apenas os últimos 7 dias (opcional)
find "$BACKUP_DIR" -name "backup_*.sql" -mtime +7 -delete
