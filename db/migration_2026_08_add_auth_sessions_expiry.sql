-- Migration : expiration des sessions d'authentification (30 jours).
-- La base utilise ddl-auto=none : appliquez via deploy/migrate-db.sh
-- (ou manuellement : psql -U <user> -d <dbname> -f ce fichier).
-- Idempotent : peut être relancé sans risque.

ALTER TABLE auth_sessions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '30 days');