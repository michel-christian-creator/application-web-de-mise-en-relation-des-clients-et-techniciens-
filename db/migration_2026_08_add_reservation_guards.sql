-- Garde-fous anti-accaparement des demandes d'intervention
-- 1) Réservation datée : libération automatique après MISSIONS_RESERVATION_HOURS
--    si la demande est encore 'assigned' sans fonds déposés ni litige.
-- 2) Compteurs de fiabilité du technicien : acceptations / déclins après
--    acceptation (alimentent le taux de réussite et le gel temporaire).

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS reserved_until TIMESTAMP NULL;

ALTER TABLE technicians
  ADD COLUMN IF NOT EXISTS acceptance_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS decline_count    INT NOT NULL DEFAULT 0;