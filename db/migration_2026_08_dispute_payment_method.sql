-- Les décisions admin de litige insèrent des paiements avec method = 'refund'
-- (remboursement au client) ou 'payout' (versement au technicien).
-- L'ancien ENUM('momo','orange','card','wallet') rejetait ces valeurs.
-- On élargit la colonne en VARCHAR(50) (les valeurs historiques sont conservées).
-- Sur le schéma PostgreSQL (méthode déjà VARCHAR(50)), ce bloc est un no-op.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'payments'
      AND c.column_name = 'method'
      AND c.data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE payments
      ALTER COLUMN method TYPE VARCHAR(50) USING method::text,
      ALTER COLUMN method SET DEFAULT 'momo',
      ALTER COLUMN method SET NOT NULL;
  END IF;
END $$;