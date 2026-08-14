-- Migration: KYC documents uploaded by users (CNI recto/verso, certificat métier, lettres de recommandation).
USE `mboatech`;

CREATE TABLE IF NOT EXISTS `kyc_documents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `doc_type` VARCHAR(50) NOT NULL,
  `file_url` VARCHAR(500) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'pending',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_kyc_user` (`user_id`),
  CONSTRAINT `fk_kyc_user`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB;
