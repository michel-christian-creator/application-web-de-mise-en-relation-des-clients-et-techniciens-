-- Ajoute la colonne payment_url : page de paiement où le client finalise sa transaction.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_url VARCHAR(500) NULL;