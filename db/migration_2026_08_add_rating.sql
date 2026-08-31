-- Migration: permet aux clients de laisser des étoiles (avis) sur les
-- techniciens. Note entre 1 et 5 stockée sur technician_recommendations.
-- NULL = recommandation d'un artisan senior ; note présente = avis client.

ALTER TABLE technician_recommendations
  ADD COLUMN IF NOT EXISTS rating SMALLINT NULL;