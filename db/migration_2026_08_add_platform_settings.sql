-- Réglages globaux de la plateforme (clé/valeur) utilisés par l'administration.
USE `mboatech`;

CREATE TABLE IF NOT EXISTS `platform_settings` (
  `setting_key` VARCHAR(64) NOT NULL,
  `setting_value` VARCHAR(255) NOT NULL DEFAULT '',
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`setting_key`)
) ENGINE = InnoDB;

-- Par défaut, les paiements sont activés.
INSERT INTO `platform_settings` (`setting_key`, `setting_value`)
VALUES ('payments_enabled', 'true')
ON DUPLICATE KEY UPDATE `setting_key` = `setting_key`;
