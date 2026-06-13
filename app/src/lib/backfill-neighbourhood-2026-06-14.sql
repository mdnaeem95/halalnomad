-- ============================================================================
-- HalalNomad — neighbourhood backfill (one-shot) — PATCHED 2026-06-12
-- ============================================================================
--
-- Purpose:
--   Populate places.neighbourhood for places in Tokyo + Singapore from the
--   per-city dictionary at product-halalnomad/data/neighbourhoods.md.
--
-- How to run:
--   1. Paste this whole file into Supabase SQL Editor (project: HalalNomad EU).
--   2. Run as one block — BEGIN ... ROLLBACK wraps everything in a single
--      transaction, so nothing is permanent until you swap ROLLBACK -> COMMIT.
--   3. Review the post-flight count queries at the bottom.
--   4. If counts look right, change the final ROLLBACK to COMMIT and re-run.
--   5. If counts look wrong, leave ROLLBACK and investigate.
--
-- Idempotency: every UPDATE is gated on `neighbourhood IS NULL`, so re-runs and
-- partial runs are safe.
--
-- ----------------------------------------------------------------------------
-- CHANGES IN THIS PATCH (vs the 2026-06-02 generated version) — why:
--
--   A LOCAL DRY-RUN against live prod (1,379 active places, 2026-06-12) showed
--   the original SQL would tag Tokyo 84.5% but Singapore only 41.1% (not the
--   ~75% the dictionary projected), AND leave Kampong Glam — the flagship
--   halal district — with ZERO tagged places. Two surgical fixes:
--
--   1. TOKYO ambiguous wards (Chuo, Minato, Kita, Koto, Ota): also match the
--      Google "<Ward> City" address format, not just "-ku". Every UPDATE is
--      already scoped `city = 'Tokyo'`, so the cross-prefecture ambiguity that
--      motivated "-ku"-only is already handled — "Minato City" / "Chuo City"
--      inside Tokyo is unambiguous. Recovers 22 high-value rows (Ginza,
--      Roppongi, Azabu, Akasaka). Tokyo 84.5% -> 96.7%.
--
--   2. SINGAPORE Kampong Glam: add postal sectors 18/19 + the Arab-quarter
--      street aliases (Kandahar, Jalan Pisang, Jalan Sultan, Sultan Gate, Bali
--      Lane, Muscat, Baghdad, Aliwal). Recovers 32 rows (Zam Zam, Hajah
--      Maimunah, Oud, Nasi Padang Minang, ...). Singapore 41.1% -> 53.2%.
--
--      DECISION (Sani, 2026-06-12): postal 18/19 -> Kampong Glam (favour halal
--      relevance). Bugis stays explicit-name-only AND now runs BEFORE Kampong
--      Glam, so a place whose address literally says "Bugis" (e.g. the two
--      "Village Hotel Bugis" rows on Victoria St, postal 18) stays Bugis;
--      everything else in sector 18/19 -> Kampong Glam.
--
-- DRY-RUN-VERIFIED expected outcome (live data 2026-06-12, all rows neighbourhood
-- IS NULL pre-run):
--   Tokyo:     181 active -> 175 tagged (96.7%),  6 still NULL.
--   Singapore: 265 active -> 141 tagged (53.2%), 124 still NULL.
--   Total this round: 316 backfilled. Sani manually tags the 130 remaining
--   NULLs (list exported separately). NOTE: Singapore's residual is mostly
--   central street-only addresses (Club St, Market St, River Valley Rd, Ann
--   Siang Hill) that cannot be safely auto-attributed — the dictionary's ~75%
--   projection was optimistic for Singapore's street+postal addressing.
--
-- All counters in the post-flight report are over ALL rows for the city (there
-- are currently 0 inactive places in Tokyo/Singapore, so active == total).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- PRE-FLIGHT: snapshot of current state
-- ----------------------------------------------------------------------------
SELECT 'PRE-FLIGHT: NULL neighbourhoods by city' AS report;

SELECT city,
       COUNT(*) AS active_total,
       COUNT(*) FILTER (WHERE neighbourhood IS NULL)     AS null_count,
       COUNT(*) FILTER (WHERE neighbourhood IS NOT NULL) AS tagged_count
FROM places
WHERE city IN ('Tokyo', 'Singapore')
GROUP BY city ORDER BY city;

-- ============================================================================
-- TOKYO — 23 special wards
-- ============================================================================

UPDATE places SET neighbourhood = 'Adachi'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mAdachi(-ku|-shi|-City)?\M' OR address_local LIKE '%足立区%' OR address_local LIKE '%足立%');

UPDATE places SET neighbourhood = 'Arakawa'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mArakawa(-ku|-shi|-City)?\M' OR address_local LIKE '%荒川区%' OR address_local LIKE '%荒川%');

UPDATE places SET neighbourhood = 'Bunkyo'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\m(Bunkyo|Bunkyō)(-ku|-shi|-City)?\M' OR address_local LIKE '%文京区%' OR address_local LIKE '%文京%');

UPDATE places SET neighbourhood = 'Chiyoda'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mChiyoda(-ku|-shi|-City)?\M' OR address_local LIKE '%千代田区%' OR address_local LIKE '%千代田%');

-- Chuo: AMBIGUOUS (Osaka's Chuo, "Chuo-dori" street). Scoped to Tokyo, so
-- accept both "-ku" and Google's "Chuo City"; require 区 suffix in Japanese.
UPDATE places SET neighbourhood = 'Chuo'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\m(Chuo|Chūō)(-ku| City)\M' OR address_local LIKE '%中央区%');

UPDATE places SET neighbourhood = 'Edogawa'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mEdogawa(-ku|-shi|-City)?\M' OR address_local LIKE '%江戸川区%' OR address_local LIKE '%江戸川%');

UPDATE places SET neighbourhood = 'Itabashi'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mItabashi(-ku|-shi|-City)?\M' OR address_local LIKE '%板橋区%' OR address_local LIKE '%板橋%');

UPDATE places SET neighbourhood = 'Katsushika'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mKatsushika(-ku|-shi|-City)?\M' OR address_local LIKE '%葛飾区%' OR address_local LIKE '%葛飾%');

-- Kita: AMBIGUOUS (Osaka's Kita, compound names like "Kita-Shinagawa").
UPDATE places SET neighbourhood = 'Kita'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mKita(-ku| City)\M' OR address_local LIKE '%北区%');

-- Koto: AMBIGUOUS (compound names).
UPDATE places SET neighbourhood = 'Koto'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\m(Koto|Kōtō)(-ku| City)\M' OR address_local LIKE '%江東区%');

UPDATE places SET neighbourhood = 'Meguro'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mMeguro(-ku|-shi|-City)?\M' OR address_local LIKE '%目黒区%' OR address_local LIKE '%目黒%');

-- Minato: AMBIGUOUS ("Minato Mirai" Yokohama, Osaka/Nagoya Minato).
UPDATE places SET neighbourhood = 'Minato'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mMinato(-ku| City)\M' OR address_local LIKE '%港区%');

UPDATE places SET neighbourhood = 'Nakano'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mNakano(-ku|-shi|-City)?\M' OR address_local LIKE '%中野区%' OR address_local LIKE '%中野%');

UPDATE places SET neighbourhood = 'Nerima'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mNerima(-ku|-shi|-City)?\M' OR address_local LIKE '%練馬区%' OR address_local LIKE '%練馬%');

-- Ota: AMBIGUOUS (short name).
UPDATE places SET neighbourhood = 'Ota'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\m(Ota|Ōta)(-ku| City)\M' OR address_local LIKE '%大田区%');

UPDATE places SET neighbourhood = 'Setagaya'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mSetagaya(-ku|-shi|-City)?\M' OR address_local LIKE '%世田谷区%' OR address_local LIKE '%世田谷%');

UPDATE places SET neighbourhood = 'Shibuya'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mShibuya(-ku|-shi|-City)?\M' OR address_local LIKE '%渋谷区%' OR address_local LIKE '%渋谷%');

UPDATE places SET neighbourhood = 'Shinagawa'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mShinagawa(-ku|-shi|-City)?\M' OR address_local LIKE '%品川区%' OR address_local LIKE '%品川%');

UPDATE places SET neighbourhood = 'Shinjuku'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mShinjuku(-ku|-shi|-City)?\M' OR address_local LIKE '%新宿区%' OR address_local LIKE '%新宿%');

UPDATE places SET neighbourhood = 'Suginami'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mSuginami(-ku|-shi|-City)?\M' OR address_local LIKE '%杉並区%' OR address_local LIKE '%杉並%');

UPDATE places SET neighbourhood = 'Sumida'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mSumida(-ku|-shi|-City)?\M' OR address_local LIKE '%墨田区%' OR address_local LIKE '%墨田%');

UPDATE places SET neighbourhood = 'Taito'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\m(Taito|Taitō)(-ku|-shi|-City)?\M' OR address_local LIKE '%台東区%' OR address_local LIKE '%台東%');

UPDATE places SET neighbourhood = 'Toshima'
WHERE neighbourhood IS NULL AND city = 'Tokyo'
  AND (address_en ~* '\mToshima(-ku|-shi|-City)?\M' OR address_local LIKE '%豊島区%' OR address_local LIKE '%豊島%');

-- ============================================================================
-- SINGAPORE — neighbourhoods + planning areas
-- ============================================================================

-- Bugis: explicit-name only, and runs BEFORE Kampong Glam so an address that
-- literally says "Bugis" stays Bugis even though it falls in sector 18/19.
UPDATE places SET neighbourhood = 'Bugis'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND address_en ~* '\mBugis\M';

-- Kampong Glam: Arab-quarter streets + postal sectors 18/19 (Sani decision
-- 2026-06-12 — 18/19 -> Kampong Glam, not Bugis). Runs after Bugis name match.
UPDATE places SET neighbourhood = 'Kampong Glam'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (
    address_en ~* '\mKampong Glam\M'
    OR address_en ~* '\mArab Street\M'
    OR address_en ~* '\mHaji Lane\M'
    OR address_en ~* '\mBussorah Street\M'
    OR address_en ~* '\mBussorah Mall\M'
    OR address_en ~* '\mKandahar Street\M'
    OR address_en ~* '\mJalan Pisang\M'
    OR address_en ~* '\mJalan Sultan\M'
    OR address_en ~* '\mSultan Gate\M'
    OR address_en ~* '\mBali Lane\M'
    OR address_en ~* '\mMuscat Street\M'
    OR address_en ~* '\mBaghdad Street\M'
    OR address_en ~* '\mAliwal Street\M'
    OR address_en ~ 'Singapore 1[89]\d{4}'
  );

UPDATE places SET neighbourhood = 'Geylang Serai'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mGeylang Serai\M' OR address_en ~ 'Singapore 39\d{4}');

UPDATE places SET neighbourhood = 'Little India'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mLittle India\M' OR address_en ~* '\mTekka\M'
       OR address_en ~* '\mSerangoon Road\M' OR address_en ~ 'Singapore 21\d{4}');

UPDATE places SET neighbourhood = 'Marina Bay'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mMarina Bay\M' OR address_en ~* '\mMarina South\M' OR address_en ~* '\mMarina Centre\M');

UPDATE places SET neighbourhood = 'Joo Chiat'
WHERE neighbourhood IS NULL AND city = 'Singapore' AND address_en ~* '\mJoo Chiat\M';

UPDATE places SET neighbourhood = 'Katong'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mKatong\M' OR address_en ~* '\mEast Coast Road\M');

UPDATE places SET neighbourhood = 'Serangoon'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mSerangoon Gardens\M'
       OR (address_en ~* '\mSerangoon\M' AND address_en !~* '\mSerangoon Road\M'));

UPDATE places SET neighbourhood = 'Orchard'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mOrchard Road\M' OR address_en ~* '\mOrchard,\M'
       OR address_en ~* '\mOrchard\s+(MRT|Mall|Plaza|Towers|Hotel)\M');

UPDATE places SET neighbourhood = 'Chinatown'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mChinatown\M' OR address_en ~* '\mKreta Ayer\M');

UPDATE places SET neighbourhood = 'Clarke Quay'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mClarke Quay\M' OR address_en ~* '\mBoat Quay\M' OR address_en ~* '\mRobertson Quay\M');

UPDATE places SET neighbourhood = 'Tanjong Pagar'
WHERE neighbourhood IS NULL AND city = 'Singapore' AND address_en ~* '\mTanjong Pagar\M';

UPDATE places SET neighbourhood = 'Tiong Bahru'
WHERE neighbourhood IS NULL AND city = 'Singapore' AND address_en ~* '\mTiong Bahru\M';

UPDATE places SET neighbourhood = 'Sentosa'
WHERE neighbourhood IS NULL AND city = 'Singapore' AND address_en ~* '\mSentosa\M';

UPDATE places SET neighbourhood = 'Bedok'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mBedok\M' OR address_en ~ 'Singapore 4[67]\d{4}');

UPDATE places SET neighbourhood = 'Tampines'
WHERE neighbourhood IS NULL AND city = 'Singapore' AND address_en ~* '\mTampines\M';

UPDATE places SET neighbourhood = 'Pasir Ris'
WHERE neighbourhood IS NULL AND city = 'Singapore' AND address_en ~* '\mPasir Ris\M';

UPDATE places SET neighbourhood = 'Changi'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mChangi\M' OR address_en ~* '\mChangi Village\M' OR address_en ~* '\mChangi Airport\M');

UPDATE places SET neighbourhood = 'Toa Payoh'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mToa Payoh\M' OR address_en ~ 'Singapore 31\d{4}');

UPDATE places SET neighbourhood = 'Bishan'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mBishan\M' OR address_en ~ 'Singapore 57\d{4}');

UPDATE places SET neighbourhood = 'Ang Mo Kio'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mAng Mo Kio\M' OR address_en ~* '\mAMK\M' OR address_en ~ 'Singapore 56\d{4}');

UPDATE places SET neighbourhood = 'Yishun'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mYishun\M' OR address_en ~ 'Singapore 76\d{4}');

UPDATE places SET neighbourhood = 'Woodlands'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mWoodlands\M' OR address_en ~ 'Singapore 7[35]\d{4}');

UPDATE places SET neighbourhood = 'Hougang'
WHERE neighbourhood IS NULL AND city = 'Singapore' AND address_en ~* '\mHougang\M';

UPDATE places SET neighbourhood = 'Punggol'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mPunggol\M' OR address_en ~ 'Singapore 82\d{4}');

UPDATE places SET neighbourhood = 'Sengkang'
WHERE neighbourhood IS NULL AND city = 'Singapore' AND address_en ~* '\mSengkang\M';

UPDATE places SET neighbourhood = 'Jurong East'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mJurong East\M' OR (address_en ~* '\mJurong\M' AND address_en ~ 'Singapore 60\d{4}'));

UPDATE places SET neighbourhood = 'Clementi'
WHERE neighbourhood IS NULL AND city = 'Singapore' AND address_en ~* '\mClementi\M';

UPDATE places SET neighbourhood = 'Bukit Timah'
WHERE neighbourhood IS NULL AND city = 'Singapore' AND address_en ~* '\mBukit Timah\M';

UPDATE places SET neighbourhood = 'Holland Village'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mHolland Village\M' OR address_en ~* '\mHolland Road\M');

UPDATE places SET neighbourhood = 'Dempsey'
WHERE neighbourhood IS NULL AND city = 'Singapore'
  AND (address_en ~* '\mDempsey\M' OR address_en ~* '\mDempsey Hill\M');

-- ============================================================================
-- POST-FLIGHT — ONE combined result set.
--
-- The Supabase SQL Editor only renders the LAST statement's grid, so coverage
-- and distribution are merged into a single SELECT here. Read it like this:
--   * section='COVERAGE'     -> expect Tokyo tagged 175 / still_null 6,
--                               Singapore tagged 141 / still_null 124.
--   * section='DISTRIBUTION' -> per-neighbourhood counts; sanity-check
--                               Singapore 'Kampong Glam' = 32 (the fix) and
--                               'Bugis' = 2.
-- The 130 remaining-NULL rows for manual tagging are already exported to
-- ~/Desktop/neighbourhood-remaining-nulls-2026-06-14.csv; the re-pull query is
-- at the very bottom (commented out — uncomment & run on its own if needed).
-- ============================================================================
SELECT section, city, label, count
FROM (
  SELECT 1 AS ord, 'COVERAGE' AS section, city, 'tagged' AS label,
         COUNT(*) FILTER (WHERE neighbourhood IS NOT NULL) AS count
    FROM places WHERE city IN ('Tokyo', 'Singapore') GROUP BY city
  UNION ALL
  SELECT 1, 'COVERAGE', city, 'still_null',
         COUNT(*) FILTER (WHERE neighbourhood IS NULL)
    FROM places WHERE city IN ('Tokyo', 'Singapore') GROUP BY city
  UNION ALL
  SELECT 2, 'DISTRIBUTION', city, neighbourhood,
         COUNT(*)
    FROM places WHERE city IN ('Tokyo', 'Singapore') AND neighbourhood IS NOT NULL
    GROUP BY city, neighbourhood
) t
ORDER BY ord, city, count DESC, label;

-- ============================================================================
-- TRANSACTION DECISION — default ROLLBACK. Swap to COMMIT once counts verify.
-- Expected (dry-run-verified 2026-06-12): Tokyo 175/181 (96.7%),
-- Singapore 141/265 (53.2%); 316 backfilled, 130 left for manual tagging.
-- ============================================================================
ROLLBACK;

-- ----------------------------------------------------------------------------
-- Optional: re-pull the remaining-NULL list (run on its own, outside the
-- transaction above — Supabase shows only the last grid):
-- SELECT id, city, name_en, address_en
-- FROM places
-- WHERE city IN ('Tokyo', 'Singapore') AND neighbourhood IS NULL
-- ORDER BY city, name_en;
