-- Chat : fonds déposés par le client (après acceptation du devis) et état du litige

ALTER TABLE service_requests
  ADD COLUMN IF NOT EXISTS funds_deposited BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS dispute_open    BOOLEAN NOT NULL DEFAULT FALSE;