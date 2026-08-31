-- Chat : suivi des messages non lus

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;