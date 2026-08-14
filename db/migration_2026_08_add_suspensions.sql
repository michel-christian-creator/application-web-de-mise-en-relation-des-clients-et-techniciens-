-- Sanctions non-présentation : suspensions progressives des techniciens
-- 1) request_declines.reason : distingue les non-présentations ('no_show')
--    des déclins volontaires (NULL).
-- 2) technicians.suspended_until : fin de la suspension temporaire
--    (5e non-présentation sur 30 jours glissants → 1 j, 6e → 3 j,
--     7e → 7 j, 8e → 10 j).
-- 3) technicians.suspended_permanent : suspension définitive (9e non-présentation).

ALTER TABLE `request_declines`
  ADD COLUMN `reason` VARCHAR(20) NULL AFTER `technician_id`;

ALTER TABLE `technicians`
  ADD COLUMN `suspended_until` DATETIME NULL AFTER `avg_response_time_sec`,
  ADD COLUMN `suspended_permanent` TINYINT(1) NOT NULL DEFAULT 0 AFTER `suspended_until`;
