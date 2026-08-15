ALTER TABLE `withdrawals`
  MODIFY `technician_user_id` BIGINT UNSIGNED NULL;

ALTER TABLE `withdrawals`
  ADD COLUMN `client_user_id` BIGINT UNSIGNED NULL AFTER `technician_user_id`,
  ADD KEY `idx_withdrawals_client` (`client_user_id`),
  ADD CONSTRAINT `fk_withdrawals_client` FOREIGN KEY (`client_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
