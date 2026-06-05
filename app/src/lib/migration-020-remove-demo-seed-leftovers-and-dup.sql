-- Migration 020: remove the off-scope demo-seed leftovers + one duplicate
--
-- Cleanup of the early hand-curated demo seed (added 2026-04-21,
-- added_by IS NULL). Migration-019 backfilled the 17 rows that fall in the
-- 8 established countries; this removes the rest:
--
--   * 34 leftovers — demo rows still city = NULL after 019 (China, Malaysia,
--     and Western cities not in the current 8-country scope). We'll rescrape
--     these properly when/if those geographies come into scope.
--   * 1 duplicate — the demo copy of "Eid Halal Korean Food" (Seoul,
--     id aa785b01…) which duplicates the real google_places-sourced row
--     (74e2c50e…, kept).
--
-- KEPT: "Honolu Halal Bento" (Tokyo) and "Yusup Pochana" (Bangkok) — the
-- proximity "dup" flags were false positives (distinct nearby restaurants);
-- both are real, unique, in-scope, and carry real verifications.
--
-- added_by IS NULL distinguishes demo rows from pipeline rows (which carry a
-- seed user id), so this cannot touch scraped data. verifications.place_id
-- and reviews.place_id are ON DELETE CASCADE, so the 9 test verifications +
-- 2 test reviews on the leftovers are removed with their places.
-- Expected: 35 rows deleted.

delete from places
where added_by is null
  and (
    city is null                                       -- 34 off-scope leftovers
    or id = 'aa785b01-a851-4065-8eb6-8e722907b1b0'      -- Eid Halal Korean Food demo duplicate
  );
