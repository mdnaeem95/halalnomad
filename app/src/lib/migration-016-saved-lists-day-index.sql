-- Migration 016: day_index column on saved_lists
--
-- Adds a nullable `day_index` integer to `saved_lists` to prep for
-- Trip Planning v1 (Phase 2, build kickoff Jun 22 2026). Trip Planning
-- groups saved places by trip day; `day_index` is the per-day bucket.
--
-- Forward-compatible with zero current consumers: `saved_lists` has no
-- UI yet (PM brief §3), so this is a pure schema add with no behaviour
-- change. Landing it this week means the Jun 22 build opens with UI
-- work, not a migration step.
--
-- NULL default = "ungrouped / not yet assigned to a day".

alter table saved_lists add column if not exists day_index integer default null;
