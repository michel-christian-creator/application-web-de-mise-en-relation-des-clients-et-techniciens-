-- Ajoute les infos necessaires a l'annulation du litige (uniquement par son auteur, dans les 24h)
ALTER TABLE service_requests
  ADD COLUMN dispute_reporter_user_id BIGINT NULL AFTER dispute_open,
  ADD COLUMN dispute_open_at DATETIME NULL AFTER dispute_reporter_user_id;
