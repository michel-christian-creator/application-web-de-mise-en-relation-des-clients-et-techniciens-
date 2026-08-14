-- Chat : planification d'intervention envoyée par le technicien
ALTER TABLE `chat_messages`
  ADD COLUMN `schedule_at` DATETIME NULL,
  ADD COLUMN `schedule_status` VARCHAR(20) NULL;

-- Utilisateur système requis pour les messages système du chat (acceptation/refus de devis et de planification)
INSERT INTO `users` (`id`, `username`, `email`, `password_hash`, `first_name`, `last_name`, `role`, `status`)
VALUES (999999999999, 'system', 'system@mboatech.com', '', 'MboaTech', 'Systeme', 'client', 'active')
ON DUPLICATE KEY UPDATE `first_name` = VALUES(`first_name`);
