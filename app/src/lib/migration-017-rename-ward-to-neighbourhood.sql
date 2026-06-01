-- Migration 017: rename ward -> neighbourhood (places + places_staging)
--
-- Migration 015 added `ward` to both tables for the Phase 2 ward
-- sub-filter and "Best in [neighbourhood]" city pages. "Ward" is
-- Tokyo-specific (ku); the surface is multi-city (Singapore, Bangkok,
-- Seoul...), so `neighbourhood` is the correct general term and matches
-- the user-facing label already used in the Phase 2 plan.
--
-- Safe rename: the column was added this week, has zero values, and no
-- app / seed / RPC code references it yet (verified). promote_staged_place()
-- still doesn't touch it.
--
-- The two partial indexes are dropped and recreated under the new name.
-- They index an all-NULL column behind a partial predicate, so they're
-- empty — the rebuild is effectively free. (A bare ALTER INDEX ... RENAME
-- would also work, but the WHERE predicate still names the column, so
-- recreating keeps the definition self-consistent.)

alter table places rename column ward to neighbourhood;
alter table places_staging rename column ward to neighbourhood;

drop index if exists idx_places_city_ward;
drop index if exists idx_places_staging_city_ward;

create index if not exists idx_places_city_neighbourhood
  on places (city, neighbourhood)
  where neighbourhood is not null;

create index if not exists idx_places_staging_city_neighbourhood
  on places_staging (city, neighbourhood)
  where neighbourhood is not null;
