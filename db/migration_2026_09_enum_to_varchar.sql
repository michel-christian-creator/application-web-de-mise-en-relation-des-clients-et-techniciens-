-- MboaTech : convertit les types ENUM natifs PostgreSQL en VARCHAR.
--
-- Les entités sont mappées avec @Enumerated(EnumType.STRING), ce qui fait
-- comparer/écrire Hibernate un simple `character varying`. PostgreSQL ne peut
-- pas comparer implicitement un VARCHAR à un type ENUM natif
-- (ERREUR : l'opérateur n'existe pas : user_role = character varying).
-- On passe donc ces colonnes en VARCHAR et on conserve la contrainte CHECK
-- pour garder les valeurs autorisées.

-- 1) users.role
ALTER TABLE users
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE VARCHAR(20)
    USING role::text,
  ALTER COLUMN role SET DEFAULT 'client';
ALTER TABLE users
  ADD CONSTRAINT chk_users_role CHECK (role IN ('client','technician','admin'));

-- 2) technicians.availability_status
ALTER TABLE technicians
  ALTER COLUMN availability_status DROP DEFAULT,
  ALTER COLUMN availability_status TYPE VARCHAR(20)
    USING availability_status::text,
  ALTER COLUMN availability_status SET DEFAULT 'available';
ALTER TABLE technicians
  ADD CONSTRAINT chk_technicians_availability_status
    CHECK (availability_status IN ('available','busy','offline'));

-- 3) attestations.level
ALTER TABLE attestations
  ALTER COLUMN level TYPE VARCHAR(20)
    USING level::text;
ALTER TABLE attestations
  ADD CONSTRAINT chk_attestations_level
    CHECK (level IN ('BRONZE','SILVER','GOLD','DIAMOND'));
