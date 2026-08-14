-- Les décisions admin de litige insèrent des paiements avec method = 'refund'
-- (remboursement au client) ou 'payout' (versement au technicien).
-- L'ancien ENUM('momo','orange','card','wallet') rejetait ces valeurs en mode
-- strict MySQL 8 -> erreur 500 et rollback de toute la transaction @Transactional.
-- On élargit la colonne en VARCHAR(50) (les valeurs historiques sont conservées).
ALTER TABLE `payments`
  MODIFY COLUMN `method` VARCHAR(50) NOT NULL DEFAULT 'momo';
