-- ============================================================================
-- ROLLBACK for backfill-neighbourhood-2026-06-14.sql
-- ============================================================================
--
-- Undoes the neighbourhood backfill by nulling `places.neighbourhood` for all
-- Tokyo + Singapore rows.
--
-- WHY a plain city-scoped null is the correct undo:
--   Immediately before the backfill ran, EVERY Tokyo and Singapore row was
--   verified `neighbourhood IS NULL` (181/181 Tokyo, 265/265 Singapore, live
--   2026-06-12). So the only non-NULL neighbourhood values in those two cities
--   are the ones the backfill itself set — nulling them all restores the exact
--   prior state.
--
-- ⚠️  CRITICAL CAVEAT — run this BEFORE any manual tagging:
--   This reverts ALL Tokyo/Singapore neighbourhood values, including any rows
--   Sani manually tags AFTER the backfill. It is an emergency "undo the
--   backfill I just ran" script, not a selective revert. If manual tagging has
--   already happened and you still need to roll back, DO NOT run this as-is —
--   ping me and we'll scope it to the 316 backfilled ids instead (the dry-run
--   id list is reproducible from the source rows).
--
-- HOW TO RUN (same safety pattern as the backfill):
--   1. Paste into Supabase SQL Editor (project: HalalNomad EU).
--   2. Run as one block — defaults to ROLLBACK, so nothing changes yet.
--   3. Check the PRE/POST counts: POST should show null_count == active_total
--      for both cities (i.e. everything back to NULL).
--   4. If correct, change the final ROLLBACK to COMMIT and re-run.
-- ============================================================================

BEGIN;

-- PRE: how many are currently tagged (should be ~175 Tokyo / ~141 Singapore)
SELECT 'ROLLBACK PRE: currently tagged' AS report;
SELECT city,
       COUNT(*) AS active_total,
       COUNT(*) FILTER (WHERE neighbourhood IS NULL)     AS null_count,
       COUNT(*) FILTER (WHERE neighbourhood IS NOT NULL) AS tagged_count
FROM places
WHERE city IN ('Tokyo', 'Singapore')
GROUP BY city ORDER BY city;

-- The revert
UPDATE places
SET neighbourhood = NULL
WHERE city IN ('Tokyo', 'Singapore')
  AND neighbourhood IS NOT NULL;

-- POST: everything should be back to NULL (null_count == active_total)
SELECT 'ROLLBACK POST: after revert' AS report;
SELECT city,
       COUNT(*) AS active_total,
       COUNT(*) FILTER (WHERE neighbourhood IS NULL)     AS null_count,
       COUNT(*) FILTER (WHERE neighbourhood IS NOT NULL) AS tagged_count
FROM places
WHERE city IN ('Tokyo', 'Singapore')
GROUP BY city ORDER BY city;

-- ----------------------------------------------------------------------------
-- Default ROLLBACK. Change to COMMIT once the POST counts confirm the revert.
-- ----------------------------------------------------------------------------
ROLLBACK;
