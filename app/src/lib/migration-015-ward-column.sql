-- Migration 015: ward column on places + places_staging
--
-- Adds a nullable `ward` (neighbourhood / administrative subdivision)
-- column to both the live `places` table and `places_staging`, plus a
-- partial composite index on (city, ward) for ward-scoped queries.
--
-- Purpose: unblocks two Phase 2 surfaces without committing any data
-- this week —
--   1. the ward sub-filter in Feature B (Advanced Filters), and
--   2. the "Best in [neighbourhood]" city-page sections.
--
-- This migration ONLY creates the column + indexes. No values are
-- backfilled, and `promote_staged_place()` is intentionally left
-- untouched — the per-city ward dictionary + backfill SQL land in a
-- follow-up next week. All existing rows stay `ward IS NULL`.
--
-- Indexes are partial (WHERE ward IS NOT NULL) so they cost nothing
-- while the column is fully null, and only grow as the backfill fills
-- it in.

alter table places add column if not exists ward text;
alter table places_staging add column if not exists ward text;

create index if not exists idx_places_city_ward
  on places (city, ward)
  where ward is not null;

create index if not exists idx_places_staging_city_ward
  on places_staging (city, ward)
  where ward is not null;
