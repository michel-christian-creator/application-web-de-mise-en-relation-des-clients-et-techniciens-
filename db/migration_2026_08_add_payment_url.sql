-- Ajoute la colonne payment_url : page Paymee où le client finalise son paiement.
USE `mboatech`;

SET @exist := (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = 'mboatech'
    AND table_name = 'payments'
    AND column_name = 'payment_url'
);
SET @sql := IF(@exist = 0,
  'ALTER TABLE `payments` ADD COLUMN `payment_url` VARCHAR(500) NULL AFTER `transaction_ref`',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
