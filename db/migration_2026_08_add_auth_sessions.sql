-- Migration: sessions d'authentification persistantes
-- (les redémarrages du backend n'invalident plus les tokens).

CREATE TABLE IF NOT EXISTS auth_sessions (
  token      VARCHAR(64) NOT NULL PRIMARY KEY,
  username   VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_username ON auth_sessions (username);