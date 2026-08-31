#!/usr/bin/env bash
# =====================================================================
# MboaTech — sauvegarde PostgreSQL avec rotation
#
# Usage :
#   BACKUP_DIR=/srv/backups ./deploy/backup-db.sh
#   ou dans crontab :
#   0 2 * * * BACKUP_DIR=/srv/backups /opt/mboa-tech/deploy/backup-db.sh
#
# Variables attendues :
#   DB_HOST DB_PORT DB_NAME DB_USERNAME DB_PASSWORD
#   BACKUP_DIR (défaut ./backups)   RETENTION (défaut 14, nombre de jours)
#
# Prérequis : le client pg_dump doit être installé.
# =====================================================================
set -euo pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-mboatech}"
DB_USERNAME="${DB_USERNAME:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION="${RETENTION:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/${DB_NAME}_${STAMP}.sql.gz"

export PGPASSWORD="$DB_PASSWORD"
PGDUMP=(pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" --no-owner)

echo ">> Sauvegarde $DB_NAME -> $OUT"
"${PGDUMP[@]}" "$DB_NAME" | gzip > "$OUT"

echo ">> Purge des sauvegardes de plus de $RETENTION jours"
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime +"$RETENTION" -delete

echo ">> Sauvegarde terminée :"
ls -lh "$OUT"