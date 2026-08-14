-- Add photo_url column to users table so the profile photo persists
USE `mboatech`;
ALTER TABLE `users` ADD COLUMN `photo_url` VARCHAR(500) NULL AFTER `phone`;
