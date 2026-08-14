-- Garde-fous anti-accaparement des demandes d'intervention
-- 1) Réservation datée : libération automatique après MISSIONS_RESERVATION_HOURS
--    si la demande est encore 'assigned' sans fonds déposés ni litige.
-- 2) Compteurs de fiabilité du technicien : acceptations / déclins après acceptation
--    (alimentent le taux de réussite et le gel temporaire des acceptations).

ALTER TABLE `service_requests`
  ADD COLUMN `reserved_until` DATETIME NULL AFTER `scheduled_at`;

ALTER TABLE `technicians`
  ADD COLUMN `acceptance_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `success_rate`,
  ADD COLUMN `decline_count` INT UNSIGNED NOT NULL DEFAULT 0 AFTER `acceptance_count`;
