# Dev report — Trip Planning M2 Wk-2 (save sheet + coalescing + "Saved to N trips")

Date: 2026-07-23. Responds to: the 2026-07-16 Wk-2 build brief.
Status: **all six tasks shipped and validated on staging** (commits
`b9e0399`, `135f136`, `8c8dd79`, `60e1d48`; preview OTAs `dbb822b5` +
`f5741ec8`, runtime 1.1.0, JS-only as expected). One serious latent bug
found by the validation matrix and fixed same-day — details below.

## Up-front asks, answered

1. **Already done:** the Wk-1 dogfood pass had surfaced a stale place-detail
   "Saved" indicator after offline removes — fixed pre-brief (`2a17990`).
   Nothing from Tasks 1–5 was started.
2. **Dogfood friction:** none new from Sani beyond the above.

## Status per task

**1. Save sheet — shipped.** Membership toggles per the locked decision
(default first + badge, tick = add, untick = the Wk-1 remove), inline
"Create new trip" (10-cap, 80-char counter, `source:'manual'`) saving the
place in the same interaction; the create's enqueue is awaited so the queue
is create-before-add by construction. Zero-trip first save stays silent
(locked Q1). A11y to the M1 standard: checkbox-role rows announcing
"«name», saved / not saved", VoiceOver toggle announcements, 44pt+ targets.

**2. "Saved to N trips" — shipped.** Count on the affordance, opens the
sheet, updates optimistically. Implementation note: the place-id-union cache
was replaced by a **membership pairs cache** — one persisted entry of every
`(list_id, place_id)` row from which the count, the sheet checks, and the
saved state all derive, so they can never disagree and the sheet is correct
offline. Delete-trip now also drops its pairs (mirrors the server cascade).

**3. Coalescing — shipped, proven at both levels.**
- *Unit tests:* 14 dedicated cases — all four brief rules plus their
  implications (chain-drop includes place ops into the doomed list;
  `default_trip_create` counts as a create with rename→title folding;
  add→remove pairs cancel nearest-first so add→remove→add keeps the final
  add; FIFO preserved for survivors; synced entities untouched). The two M1
  tests asserting "no coalescing" were updated to the new contract.
- *On-device proof:* offline create → rename ×2 → delete → reconnect →
  SQL-verified **zero rows on the server** (`name ilike '%coalesce%'` → 0).

**4. Events — confirmed in PostHog EU 191007.** Sheet saves fire
`place_saved_to_list {source_screen:'place_detail'}`, unticks fire
`place_removed_from_list`, sheet-creates fire `trip_list_created
{source:'manual'}` (observed create+save in the same second). **No new event
names.** No sheet-open signal added — PM flag: if wanted, suggest a
`via_sheet` property on the existing save/remove events, not a new name.
One nuance now visible in dashboards: events fire on enqueue ("durably
accepted", the M1 design), so PostHog counts include ops the coalescer
later killed — event counts ≠ server writes by design.

**5. On-device validation — 16-step matrix, 15 clean passes** (sheet
correctness on/offline, kill/reopen persistence, create-in-sheet, cap,
regressions, VoiceOver). The B11 server-side check **failed** and became
the week's most valuable find:

### Incident: the B11 ghost-trip poison (found, root-caused, fixed same-day)

Device showed a place saved to 4 trips; server had 1 row. Root cause via
PostHog lifecycle reconstruction: some cached trips were **ghosts** —
client-only rows whose creates never landed (Wk-1-era loss). Toggling a
ghost enqueued a `place_add` the server must reject (FK) → permanent
failure **blocked the FIFO head** for MAX_ATTEMPTS drains, freezing every
write behind it — and the idle reconcile only fired after *clean* drains,
so the client never re-synced and the divergence stayed silent. Fix
(`8c8dd79`, OTA `f5741ec8`): permanent data errors (FK/RLS post
session-refresh) **drop immediately** with a Sentry `permanent-data-error`
tag, and reconciliation fires after **any** drain that empties the queue,
including drop-only — stale optimistic state now self-heals to server
truth. Transient network failures keep the never-dropped guarantee.
Repro + fix proven in `write-queue-b11-repro.test.ts`; suite is 95 tests.
Post-fix, the affected device self-heals on first online drain (ghosts
vanish, the stuck trip + membership land). Follow-up candidate for Wk-3:
a small server-side hardening so `add_place_to_list` no-ops on a missing
list instead of erroring.

**6. Permission-event tidy — shipped and verified.** Fires only on decision
*change* (last status persisted), not per session. Verified in PostHog: one
legitimate re-baseline event after the OTA, then silence across multiple
kill/reopens. The C2 tile counts people-decisions from now on; historical
data before 2026-07-22 remains session-inflated.

## Carry-overs / notes for Wk-3

- Confirm on Sani's device post-`f5741ec8`: ghost trips gone, trip "F" +
  membership landed (re-run the B11 SQL). Expected but not yet observed.
- Server hardening for `add_place_to_list` (no-op on missing list) —
  optional migration alongside Wk-3.
- PostHog RN appears to lose some offline-buffered events on app-kill
  (offline session events partially missing from history) — analytics-only,
  low priority, worth a look when instrumentation is next touched.
- Wk-3 scope untouched per the brief: drag-reorder, search-within-list,
  M2 close + TestFlight.
