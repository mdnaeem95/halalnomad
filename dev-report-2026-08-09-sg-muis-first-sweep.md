# Dev report — SG MUIS-first Restaurant sweep

Date: 2026-08-09. Responds to: the PM-approved **CURATED, Restaurant-scheme-only,
human-reviewed, chains-grouped-not-collapsed** MUIS-first sweep (queued behind the
Bangkok sweep, now unblocked). Status: **staged, awaiting Sani's review.**

## What ran

**Enumerated the full MUIS register** via the public establishments API. The API
takes only a `text` substring (name+address), caps hard at 200 rows/query, ignores
`start` paging and server-side `scheme` filters, and returns nothing on an empty
query — so a letter 2-gram sweep with cap-expansion was the only route. 2,600
queries → **4,359 unique establishments**, of which **1,879 are subScheme
"Restaurant"** (the target). 22 capped-unexpanded grams remain (common address
words like AVENUE/CENTRAL) — coverage is near-complete, not provably 100%.

**Deduped against our catalog** (257 SG places, 51 already MUIS-certified):
- 37 already ours by `cert_id` (Restaurant-subScheme subset of the pilot's 51)
- 30 match an existing uncertified place by **name+postal** → upgrade candidates
- 61 match by **name only** (postal disagrees) → verify before trusting
- **1,751 net-new**

**Curated per the approved scope — dropped global chains, kept local.** The
Restaurant register is 69% chains, and most of that is global fast-food: 153
McDonald's, 148 Subway, 78 Burger King, 75 Coffee Bean, 73 KFC, 41 Pizza Hut…
Per Sani's "local only, drop global chains" call, **847 global/international
mass-market outlets dropped** (27 brands). **904 local kept** → 900 geocoded
(the other 4: a floating kelong with postal `000000`, and one OneMap gap).

**Geocoded via OneMap, not Google.** Every MUIS row carries a postal; OneMap
(the SG government geocoder) is free and authoritative for SG addresses. Its
un-tokened search enforces an API token inconsistently, so geocoding needed
retry-on-auth-error + backoff — 900/904 resolved. **Zero Google spend.**

**Staged 900 rows** into `places_staging` (`source='muis'`, `cert_body='MUIS'`,
`cert_id=<number>`, `cert_status='current'`, `cert_expires=NULL` — MUIS publishes
no expiry, `proposed_halal_level=1`). On promotion each becomes
`effective_halal_level=4` (Trusted) via the migration-027 generated column.
All `reviewed=false` — nothing is live yet.

## The review queue

`pilot-sg-muis-first-review-queue.md`:
- **A. 138 chains grouped** (636 outlets), 15 flagged ⚠ local mass-market
  (Mr Bean, Old Chang Kee, Heavenly Wang, Kaffe & Toast, Kopi & Tarts, 4Fingers…)
  — kept because they're *local* not *global*, but the reviewer may still drop
  them. Grouped, not collapsed: reject a whole brand with one call.
- **B. 264 independent restaurants** (singletons) — the discovery gold.
- **C. 30 upgrade candidates** — existing uncertified places whose name+postal
  match a MUIS cert. Same high-confidence bar the pilot used. Add cert → Trusted.
- **D. 61 name-only matches** — verify (same brand different outlet, or coincidence).

## Impact if promoted in full

SG catalog **257 → ~1,100+**, and it flips from mostly-Reported to
**overwhelmingly cert-Trusted** — the single biggest trust-quality jump in the
catalog, all backed by a real certification body (unlike the Google-sourced
Reported tiers elsewhere). This is the MUIS moat the pilot proved, run at scale.

## Handoff + next

1. **Sani's review pass** on the queue (chains as groups; the ⚠ mass-market call;
   the 30 upgrades; the 61 name-only). Tell me the reject list.
2. I apply approvals → `promote.py run --city singapore` → SG live count update
   on `/cities` (Seoul/Bangkok pattern). No app OTA needed (live counts).
3. Method note for the record: enumeration is a 2-gram sweep, ~99% not 100%;
   a second pass on the 22 capped grams would close the tail if we want it.
