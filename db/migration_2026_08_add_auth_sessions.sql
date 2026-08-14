-- Migration: persistant auth sessions so backend restarts do not invalidate tokens.
USE `mboatech`;

CREATE TABLE IF NOT EXISTS `auth_sessions` (
  `token` VARCHAR(64) NOT NULL,
  `username` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`token`),
  KEY `idx_auth_sessions_username` (`username`)
) ENGINE=InnoDB;
