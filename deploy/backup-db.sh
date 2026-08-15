#!/usr/bin/env bash
# =====================================================================
# MboaTech — sauvegarde MySQL avec rotation
#
# Usage :
#   BACKUP_DIR=/srv/backups ./deploy/backup-db.sh
#   ou dans crontab :
#   0 2 * * * BACKUP_DIR=/srv/backups /opt/mboa-tech/deploy/backup-db.sh
#
# Variables attendues :
#   DB_HOST DB_PORT DB_NAME DB_USERNAME DB_PASSWORD
#   BACKUP_DIR (défaut ./backups)   RETENTION (défaut 14, nombre de jours)
# =====================================================================
set -euo pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-mboatech}"
DB_USERNAME="${DB_USERNAME:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION="${RETENTION:-14}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/${DB_NAME}_${STAMP}.sql.gz"

MYSQLDUMP=(mysqldump -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME" \
  --single-transaction --routines --triggers --default-character-set=utf8mb4)
[ -n "$DB_PASSWORD" ] && MYSQLDUMP+=(-p"$DB_PASSWORD")

echo ">> Sauvegarde $DB_NAME -> $OUT"
"${MYSQLDUMP[@]}" "$DB_NAME" | gzip > "$OUT"

echo ">> Purge des sauvegardes de plus de $RETENTION jours"
find "$BACKUP_DIR" -name "${DB_NAME}_*.sql.gz" -type f -mtime +"$RETENTION" -delete

echo ">> Sauvegarde terminée :"
ls -lh "$OUT"
