#!/usr/bin/env bash
# =====================================================================
# MboaTech — migrations PostgreSQL
#
# Usage :
#   ./deploy/migrate-db.sh --fresh     Installation neuve : schéma complet
#                                      (db/schema_updated.sql) puis toutes les
#                                      migrations, avec enregistrement.
#   ./deploy/migrate-db.sh             Mise à jour d'une base existante :
#                                      n'applique que les migrations non
#                                      encore enregistrées dans schema_migrations.
#
# Variables attendues (ou passées en argument) :
#   DB_HOST DB_PORT DB_NAME DB_USERNAME DB_PASSWORD
#
# Prérequis : le client psql doit être installé et l'utilisateur doit avoir
# les droits de création sur la base.
#
# Exemple : DB_USERNAME=mboatech_app DB_PASSWORD=... ./deploy/migrate-db.sh
# =====================================================================
set -euo pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-mboatech}"
DB_USERNAME="${DB_USERNAME:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-}"
FRESH="${1:-}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_DIR="$ROOT_DIR/db"

export PGPASSWORD="$DB_PASSWORD"
PSQL=(psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME")
PSQL_DB=(psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_NAME")

echo ">> Cible : $DB_USERNAME@$DB_HOST:$DB_PORT/$DB_NAME"

if [ "$FRESH" = "--fresh" ]; then
  echo ">> Installation neuve : import de db/schema_updated.sql"
  "${PSQL_DB[@]}" -f "$DB_DIR/schema_updated.sql"
fi

# Table de suivi des migrations appliquées (créée si absente).
"${PSQL_DB[@]}" -c \
  "CREATE TABLE IF NOT EXISTS schema_migrations (
     file VARCHAR(255) NOT NULL PRIMARY KEY,
     applied_at TIMESTAMP NOT NULL DEFAULT NOW()
   );" || true

for f in "$DB_DIR"/migration_*.sql; do
  [ -e "$f" ] || continue
  base="$(basename "$f")"
  done="$( "${PSQL_DB[@]}" -tA -c "SELECT COUNT(*) FROM schema_migrations WHERE file='$base';" )"
  if [ "$done" != "0" ]; then
    echo "== Ignorée (déjà appliquée) : $base"
    continue
  fi
  echo ">> Application : $base"
  "${PSQL_DB[@]}" -f "$f"
  "${PSQL_DB[@]}" -c "INSERT INTO schema_migrations (file) VALUES ('$base');"
done

echo ">> Migrations terminées."