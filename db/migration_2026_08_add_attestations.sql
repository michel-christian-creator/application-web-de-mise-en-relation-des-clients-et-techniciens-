-- Migration: attestations table
-- Système d'attestation de service pour les techniciens

CREATE TABLE IF NOT EXISTS `attestations` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `technician_id` BIGINT UNSIGNED NOT NULL,
  `intervention_count` INT UNSIGNED NOT NULL,
  `avg_rating` DECIMAL(3,1) NOT NULL,
  `level` ENUM('BRONZE','SILVER','GOLD','DIAMOND') NOT NULL,
  `attestation_number` VARCHAR(30) NOT NULL,
  `generated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_attestation_number` (`attestation_number`),
  KEY `idx_attestation_technician` (`technician_id`),
  CONSTRAINT `fk_attestation_technician` FOREIGN KEY (`technician_id`) REFERENCES `technicians` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB;
