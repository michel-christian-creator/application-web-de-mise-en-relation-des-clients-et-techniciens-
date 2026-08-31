-- Ajoute la colonne photo_url à users pour que la photo de profil persiste.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500) NULL;