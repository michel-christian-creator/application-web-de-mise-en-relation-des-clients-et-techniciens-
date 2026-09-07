-- MboaTech : migration des niveaux d'urgence vers des valeurs enum uppercase.
--
-- Apres le passage de l'entite ClientRequest.urgency de String vers
-- UrgencyLevel avec @Enumerated(EnumType.STRING), Hibernate ecrit
-- "NORMAL", "IMPORTANT", "CRITICAL" en base.
-- Cette migration met a jour les contraintes CHECK et les valeurs existantes.

-- 1) Mettre a jour les valeurs existantes vers la casse uppercase
UPDATE service_requests
   SET urgency = UPPER(urgency)
 WHERE urgency IN ('normal','important','critique');

-- 2) Mettre a jour la valeur par defaut
ALTER TABLE service_requests
  ALTER COLUMN urgency SET DEFAULT 'NORMAL';

-- 3) Recreer la contrainte CHECK avec les nouvelles valeurs
DO $$ BEGIN
  ALTER TABLE service_requests DROP CONSTRAINT IF EXISTS chk_service_requests_urgency;
EXCEPTION WHEN undefined_object THEN NULL; END $$;

ALTER TABLE service_requests
  ADD CONSTRAINT chk_service_requests_urgency
    CHECK (urgency IN ('NORMAL','IMPORTANT','CRITICAL'));
