-- Migration : expiration des sessions d'authentification (30 jours).
-- La base utilise ddl-auto=none : appliquez via deploy/migrate-db.sh
-- (ou manuellement : mysql -u <user> -p <dbname> < ce fichier).
-- Idempotent : peut être relancé sans risque.

USE `mboatech`;

SET @col_exists = (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'auth_sessions'
      AND COLUMN_NAME = 'expires_at'
);
SET @ddl = IF(@col_exists = 0,
    'ALTER TABLE `auth_sessions` ADD COLUMN `expires_at` DATETIME NOT NULL DEFAULT (DATE_ADD(NOW(), INTERVAL 30 DAY))',
    'SELECT 1');
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
