-- Réglages globaux de la plateforme (clé/valeur) utilisés par l'administration.

CREATE TABLE IF NOT EXISTS platform_settings (
  setting_key   VARCHAR(64) NOT NULL PRIMARY KEY,
  setting_value VARCHAR(255) NOT NULL DEFAULT '',
  updated_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Par défaut, les paiements sont activés.
INSERT INTO platform_settings (setting_key, setting_value)
VALUES ('payments_enabled', 'true')
ON CONFLICT (setting_key) DO NOTHING;