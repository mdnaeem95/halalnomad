-- Migration 019: backfill city/country on the early demo-seed places
--
-- 51 active places (added 2026-04-21, added_by NULL — the early hand-
-- curated test seed) have city = NULL because they pre-date the city/
-- country columns (migration-012) and never came through the
-- google_places staging pipeline. With NULL city they're invisible in the
-- Browse view (which filters `city IS NOT NULL`), so the table total
-- (1413) and the Browse count (1362) disagreed by exactly these 51.
--
-- Scope decision: backfill only the rows whose city falls in one of the 8
-- countries already established in the table (Japan, South Korea, Thailand,
-- Singapore, Vietnam, Hong Kong, Philippines, Taiwan). Of the 51 that's
-- 17 rows across 4 cities. The remaining 34 (China, Malaysia, and various
-- out-of-scope Western cities) are left NULL for now — adding their
-- countries is a separate, deliberate decision.
--
-- City is derived from the address (each ends in its city). Each statement
-- is scoped to `city IS NULL` so it can't touch already-populated rows, and
-- to a single city token so it only hits its intended subset of the 51.

update places set city = 'Tokyo',     country = 'Japan'
where is_active and city is null and address_en ilike '%tokyo%';

update places set city = 'Seoul',     country = 'South Korea'
where is_active and city is null and address_en ilike '%seoul%';

update places set city = 'Bangkok',   country = 'Thailand'
where is_active and city is null and address_en ilike '%bangkok%';

update places set city = 'Singapore', country = 'Singapore'
where is_active and city is null and address_en ilike '%singapore%';
