-- Chat : planification d'intervention envoyée par le technicien

ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS schedule_at TIMESTAMP NULL,
  ADD COLUMN IF NOT EXISTS schedule_status VARCHAR(20) NULL;

-- Utilisateur système requis pour les messages système du chat
-- (acceptation/refus de devis et de planification).
INSERT INTO users (id, username, email, password_hash, first_name, last_name, role, status)
VALUES (999999999999, 'system', 'system@mboatech.com', '', 'MboaTech', 'Systeme', 'client', 'active')
ON CONFLICT (id) DO UPDATE SET first_name = EXCLUDED.first_name;