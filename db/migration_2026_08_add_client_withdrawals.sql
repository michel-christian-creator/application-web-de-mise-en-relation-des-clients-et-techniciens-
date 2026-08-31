-- Migration : retraits client (client_user_id) et assouplissement du
-- rattachement au technicien (nullable).
--
-- NOTE d'ordre d'exécution : la table withdrawals est créée par la migration
-- migration_2026_08_add_withdrawals.sql (classée alphabétiquement APRÈS
-- ce fichier). En installation neuve (--fresh), cette migration ne fait donc
-- rien (table absente) et add_withdrawals crée directement le modèle final.
-- En mise à jour d'une base PostgreSQL existante (table withdrawals déjà
-- présente sans colonne client), ce bloc est effectif.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'withdrawals'
  ) THEN
    ALTER TABLE withdrawals ALTER COLUMN technician_user_id DROP NOT NULL;
    ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS client_user_id BIGINT NULL;
    CREATE INDEX IF NOT EXISTS idx_withdrawals_client ON withdrawals (client_user_id);

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'withdrawals'
        AND constraint_name = 'fk_withdrawals_client'
    ) THEN
      ALTER TABLE withdrawals
        ADD CONSTRAINT fk_withdrawals_client FOREIGN KEY (client_user_id)
        REFERENCES users (id) ON DELETE CASCADE;
    END IF;
  END IF;
END $$;