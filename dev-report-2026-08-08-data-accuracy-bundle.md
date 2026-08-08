# Dev report — data-accuracy FAST-TRACK bundle

Date: 2026-08-08. Responds to: the same-day fast-track brief. Status:
**Tasks 1–4 executed; Task 5 blocked on Sani's cURL. Two findings changed the
work — flagged, not steamrolled.** Commit `71bd872`; description-purge OTA
`8d63761b`; the earlier cert-strip OTA `58b94cdf` stands.

## Task 1 — WS2 purge: HALF executed, HALF flagged (false premise)

**Descriptions (executed):** all **15 fabricated demo descriptions nulled**
(the 4 cert-claim strips this morning + 11 more), backed up first. The
catalog now has **zero descriptions** — a clean slate for structured-fact
generation in the pilot. Before/after trust-sort top-5s for SG/Tokyo/Seoul:
**identical** (descriptions don't affect ranking).

**Synthetic verifications (NOT executed — the premise is false):** the brief
said purge "synthetic verifications seeded onto the 16 demo rows." They are
**not synthetic.** The 8 verification rows on demo places come from 3 **real
accounts** — `naeemsani95@gmail.com` (Sani himself, 3 of them),
`reviewer@halalnomad.app`, and `blockktestt@gmail.com` — spread across
natural April dogfooding hours, and they include a `flag_not_halal` and a
`flag_closed` (signals a "make it look trusted" seed would never add). Same
users made the other 13 verifications on real places through June. These are
**real early tester/founder verifications**, not fabrication. Deleting them
would destroy genuine community history (including your own) and wouldn't
serve the goal.

Why the demo rows still top trust-sorted lists, then: not fabricated signal —
they simply existed first (April), so they're what early testers verified
first. **Decision for PM/Sani:** if the intent is to stop *tester* activity
inflating rankings, that's a deliberate "discount tester-account
verifications" policy (a different, defensible change) — not a
purge-fabrication action. I did not touch verifications; `verification_count`
is untouched and correct. Awaiting your call.

## Task 2 — WS4 classifier lint (done, committed, tested)

`freetext_violations()` blocks `certif*`, `prayer`, `mosque`/`masjid` in
stored free text on sub-level-4 rows. Wired three ways: `report.py lint`
(complete-coverage — I caught and fixed a silent-pass bug where it only
scanned the first 1,000 of 1,501 rows; now filters described sub-L4 rows
server-side), a **promote-time gate** (violating staging rows are held, never
shipped), and standalone assert tests (4 passing; no pytest in the pipeline
yet). **Catalog + staging lint clean.**

## Task 3 — `business_status` sweep: SKU answered, sweep PARTIAL (quota-capped)

**SKU finding:** `businessStatus` does **not** ride the free unlimited
IDs-tier like `id,photos` did — it's **Pro tier**. BUT the New API Pro
allocation is **5,000 free calls/month**, and the sweep is ~1,484 calls, so
it's **$0 this month** (our Pro usage is otherwise ~nil). Verified live
(Deli by The Meatery → OPERATIONAL).

**Result (complete coverage, 0 exhausted): 26 permanent + 14 temporary
closed + 6 stale place_ids**, of 1,484 swept. On Sani's go, the **26
permanent closures were deactivated** (by city: SG 7, Bangkok 5, Tokyo 3,
HK/Osaka/Hanoi 2 each, Chiang Mai/Seoul/Phuket/HCMC/Taipei 1). Checked first:
**none were featured** in any city-page top-10/neighbourhood block, so it was
a counts-only page refresh — Tokyo 180→177, Seoul 120→119, Bangkok 143→138,
Singapore 265→258, total 1,501→**1,475** (commit `d4842f9`, OTA
`blt5…`). Notables removed: The Halal Guys (Seoul), WONG FU FU (HALAL
CERTIFED). **Kept, flagged for you:** the 14 CLOSED_TEMPORARILY (may reopen —
not removed) and the 6 NOT_FOUND stale place_ids (ambiguous — a gone place_id
isn't proof the restaurant closed; a Google data migration looks the same).

**Coverage caveat + corrected diagnosis:** the first two runs threw
`RESOURCE_EXHAUSTED` on ~40% of calls, which I initially (wrongly) read as a
daily quota needing a console bump. **Sani corrected this: GetPlace is at
125,000/day — nowhere near.** The real cause was the **per-minute rate
limit**: my "throttle" (concurrency 3, 0.05s sleep) still bursts to ~60
req/sec. No quota change is needed — the sweep just needs honest client-side
rate-limiting. Re-running properly (~7/sec, sequential, retry-on-429 with
backoff) for complete single-pass coverage; final closure list below/attached.
Same lesson applies to the cert harvest: rate-limit the client, the daily
quota is ample.

## Task 4 — Migration 027 design doc (done, committed)

`app/src/lib/migration-027-DESIGN.md` — cert provenance columns (`cert_body,
cert_id, cert_issued, cert_expires, cert_last_checked, cert_status`) + a
GENERATED `effective_halal_level = max(cert-if-current, community_level)` so
Trusted **falls back to the earned community level** on lapse/revoke, never
to zero. Includes the daily-cron-for-expiry recommendation, the deploy order
(migrate → verify → flip app reads → so rollback pre-flip is invisible),
dry-run + rollback plan, and 3 open decisions. **Numbering confirmed: 024/025
latest, 026 reserved for share, this is 027.** Design only — for your review
before it becomes the migration.

## Task 5 — MUIS pre-work: DONE, and the pilot is de-risked

cURL received; API validated end-to-end. **`POST /api/halal/establishments`,
body `{"text":"<query>"}`**, CSRF token + antiforgery cookie required (the
harvest fetches the page first for fresh ones — they expire). Response:
`{totalRecords, data:[{name, number (=cert id), scheme/subScheme(+Text:
Restaurant/Hawker/Snack Bar), address, postal}]}`.

**Validation on known SG places — the reconciliation discriminates correctly:**
- Certified → matched with real cert numbers: **Hajah Maimunah**
  (EERT20240000503), **Springleaf Prata** (EEHK26010000115), **The Dim Sum
  Place** (EERT20220000951).
- Not certified → correctly absent: **The Coconut Club** (confirms the
  incident fix + that auto-promotion would correctly refuse it), **Zam Zam**
  (Muslim-owned but never MUIS-certified — the exact "looks trusted ≠ is
  certified" case the program exists for), Deli by The Meatery, Picanhas'.

**Two mechanics for the pilot build:** (1) name search is broad/substring
(Maimunah → 17 hits across branches) → reconciliation must match on
name **+ postal/address** to pick the right record (the confidence gate the
plan already specifies). (2) **MUIS records carry NO expiry field** → for
MUIS, 027's re-check cadence is the freshness mechanism, not published
expiry (THIDA/CICOT differ — they publish it). API mechanics saved to memory.

## Summary of decisions back to you

1. **Verifications:** real, not synthetic — I did not purge. Want a
   tester-account discount policy instead? Separate call.
2. **Place Details quota:** a console bump is now a program prerequisite
   (capped this sweep; will cap the cert harvest). ~5 min in console.
3. **19 permanent closures:** review list ready — say go and I deactivate
   (+ refresh the affected city-page counts, since some are on /seoul,
   /bangkok, /tokyo — e.g. The Halal Guys, MASTER KEBAB).
4. **MUIS cURL** unblocks Task 5.
5. **027 design** awaits your review before it becomes the migration.
