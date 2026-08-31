-- Ajoute les infos nécessaires à l'annulation du litige
-- (uniquement par son auteur, dans les 24h)

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS dispute_reporter_user_id BIGINT NULL,
  ADD COLUMN IF NOT EXISTS dispute_open_at TIMESTAMP NULL;