-- MySQL schema for MboaTech
-- Create the database and tables for users, artisans, service requests, payments, chats, documents and disputes.

CREATE DATABASE IF NOT EXISTS `mboatech`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `mboatech`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `email` VARCHAR(255) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `first_name` VARCHAR(100) NOT NULL,
  `last_name` VARCHAR(100) NOT NULL,
  `role` ENUM('client','technician','admin','support') NOT NULL DEFAULT 'client',
  `domain` VARCHAR(150) NULL,
  `city` VARCHAR(120) NULL,
  `location` VARCHAR(255) NULL,
  `phone` VARCHAR(30) NULL,
  `status` ENUM('active','inactive','pending','suspended') NOT NULL DEFAULT 'active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `technician_profiles` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `bio` TEXT NULL,
  `specialties` TEXT NULL,
  `rating_avg` DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  `rating_count` INT UNSIGNED NOT NULL DEFAULT 0,
  `experience_years` TINYINT UNSIGNED NULL,
  `hourly_rate` DECIMAL(10,2) NULL,
  `verified` TINYINT(1) NOT NULL DEFAULT 0,
  `availability_status` ENUM('available','busy','offline') NOT NULL DEFAULT 'available',
  `photo_url` VARCHAR(500) NULL,
  `success_rate` DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  `avg_response_time_sec` INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_profile_unique` (`user_id`),
  CONSTRAINT `fk_technician_profiles_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `service_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `client_id` BIGINT UNSIGNED NOT NULL,
  `technician_id` BIGINT UNSIGNED NULL,
  `category` VARCHAR(100) NOT NULL,
  `description` TEXT NOT NULL,
  `urgency` ENUM('normal','important','critique') NOT NULL DEFAULT 'normal',
  `status` ENUM('draft','published','assigned','in_progress','completed','cancelled','disputed') NOT NULL DEFAULT 'published',
  `budget_min` DECIMAL(10,2) NULL,
  `budget_max` DECIMAL(10,2) NULL,
  `address` VARCHAR(255) NULL,
  `city` VARCHAR(120) NULL,
  `scheduled_at` DATETIME NULL,
  `completed_at` DATETIME NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_service_requests_client` (`client_id`),
  KEY `idx_service_requests_technician` (`technician_id`),
  CONSTRAINT `fk_service_requests_client` FOREIGN KEY (`client_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_service_requests_technician` FOREIGN KEY (`technician_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `service_request_id` BIGINT UNSIGNED NOT NULL,
  `sender_id` BIGINT UNSIGNED NOT NULL,
  `message_text` TEXT NULL,
  `attachment_url` VARCHAR(500) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_chat_service_request` (`service_request_id`),
  KEY `idx_chat_sender` (`sender_id`),
  CONSTRAINT `fk_chat_messages_request` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_chat_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `payments` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `service_request_id` BIGINT UNSIGNED NOT NULL,
  `payer_id` BIGINT UNSIGNED NOT NULL,
  `payee_id` BIGINT UNSIGNED NOT NULL,
  `amount` DECIMAL(12,2) NOT NULL,
  `currency` VARCHAR(10) NOT NULL DEFAULT 'XAF',
  `status` ENUM('pending','held','released','refunded','failed') NOT NULL DEFAULT 'pending',
  `method` VARCHAR(50) NOT NULL DEFAULT 'momo',
  `transaction_ref` VARCHAR(255) NULL,
  `payment_url` VARCHAR(500) NULL,
  `notes` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_payments_request` (`service_request_id`),
  CONSTRAINT `fk_payments_request` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payments_payer` FOREIGN KEY (`payer_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_payments_payee` FOREIGN KEY (`payee_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `documents` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `type` ENUM('id_card','recommendation_letter','certification','other') NOT NULL DEFAULT 'other',
  `file_url` VARCHAR(500) NOT NULL,
  `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `review_comments` TEXT NULL,
  `uploaded_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `reviewed_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `idx_documents_user` (`user_id`),
  CONSTRAINT `fk_documents_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS `disputes` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `service_request_id` BIGINT UNSIGNED NOT NULL,
  `reported_by` BIGINT UNSIGNED NOT NULL,
  `description` TEXT NOT NULL,
  `status` ENUM('open','under_review','resolved','rejected') NOT NULL DEFAULT 'open',
  `resolution` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `resolved_at` TIMESTAMP NULL,
  PRIMARY KEY (`id`),
  KEY `idx_disputes_request` (`service_request_id`),
  CONSTRAINT `fk_disputes_request` FOREIGN KEY (`service_request_id`) REFERENCES `service_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_disputes_reported_by` FOREIGN KEY (`reported_by`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB;
