CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `technician_user_id` BIGINT UNSIGNED NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `method` ENUM('momo','orange','bank') NOT NULL DEFAULT 'momo',
  `account` VARCHAR(60) NOT NULL,
  `status` ENUM('pending','paid','rejected') NOT NULL DEFAULT 'pending',
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_withdrawals_technician` (`technician_user_id`),
  CONSTRAINT `fk_withdrawals_technician` FOREIGN KEY (`technician_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB;
