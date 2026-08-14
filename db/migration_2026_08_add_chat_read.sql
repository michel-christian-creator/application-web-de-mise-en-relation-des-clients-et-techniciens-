-- Chat : suivi des messages non lus
ALTER TABLE `chat_messages` ADD COLUMN `is_read` BOOLEAN NOT NULL DEFAULT FALSE;
