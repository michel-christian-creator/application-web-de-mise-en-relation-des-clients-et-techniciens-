#!/usr/bin/env bash
# =====================================================================
# MboaTech — migrations MySQL
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
# Exemple : DB_USERNAME=mboatech_app DB_PASSWORD=... ./deploy/migrate-db.sh
# =====================================================================
set -euo pipefail

DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-3306}"
DB_NAME="${DB_NAME:-mboatech}"
DB_USERNAME="${DB_USERNAME:-root}"
DB_PASSWORD="${DB_PASSWORD:-}"
FRESH="${1:-}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB_DIR="$ROOT_DIR/db"
MYSQL=(mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USERNAME")
[ -n "$DB_PASSWORD" ] && MYSQL+=(-p"$DB_PASSWORD")

echo ">> Cible : $DB_USERNAME@$DB_HOST:$DB_PORT/$DB_NAME"

if [ "$FRESH" = "--fresh" ]; then
  echo ">> Installation neuve : import de db/schema_updated.sql"
  "${MYSQL[@]}" "$DB_NAME" < "$DB_DIR/schema_updated.sql"
fi

# Table de suivi des migrations appliquées (crée si absente).
"${MYSQL[@]}" "$DB_NAME" -e \
  "CREATE TABLE IF NOT EXISTS schema_migrations (
     file VARCHAR(255) NOT NULL PRIMARY KEY,
     applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB;" || true

for f in "$DB_DIR"/migration_*.sql; do
  [ -e "$f" ] || continue
  base="$(basename "$f")"
  done="$( "${MYSQL[@]}" "$DB_NAME" -N -e "SELECT COUNT(*) FROM schema_migrations WHERE file='$base';" )"
  if [ "$done" != "0" ]; then
    echo "== Ignorée (déjà appliquée) : $base"
    continue
  fi
  echo ">> Application : $base"
  "${MYSQL[@]}" "$DB_NAME" < "$f"
  "${MYSQL[@]}" "$DB_NAME" -e "INSERT INTO schema_migrations (file) VALUES ('$base');"
done

echo ">> Migrations terminées."
