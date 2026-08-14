-- Migration: allow clients to leave star ratings (avis) on technicians.
-- A rating between 1 and 5 is stored on technician_recommendations.
-- NULL rating = recommendation from a senior artisan; rating present = client review.

USE `mboatech`;

ALTER TABLE `technician_recommendations`
  ADD COLUMN `rating` TINYINT UNSIGNED NULL COMMENT 'Note étoiles (1-5) laissée par un client. NULL = recommandation artisan senior.'
  AFTER `comment`;
