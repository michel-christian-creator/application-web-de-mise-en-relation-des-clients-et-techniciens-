-- Migration: portfolio of before/after proofs (réalisations) added by technicians.
USE `mboatech`;

CREATE TABLE IF NOT EXISTS `portfolio_items` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `technician_id` BIGINT UNSIGNED NOT NULL,
  `label` VARCHAR(200) NOT NULL DEFAULT '',
  `before_url` VARCHAR(500) NULL,
  `after_url` VARCHAR(500) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_portfolio_technician` (`technician_id`),
  CONSTRAINT `fk_portfolio_technician`
    FOREIGN KEY (`technician_id`) REFERENCES `technicians` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB;
