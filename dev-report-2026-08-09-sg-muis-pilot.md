# Dev report — Singapore/MUIS certification pilot (WS1)

Date: 2026-08-09. Responds to: the pilot brief. Status: **SHIPPED — Singapore has 51 Trusted places live.** 027 applied +
verified; audit approved; 51 promoted; app read-path flipped; descriptions
backfilled catalog-wide. Commit `dc831a4`; audit list:
`pilot-sg-muis-audit-list.md`.

## Task 1 — Migration 027 (written; you apply — I have no DDL access)

`app/src/lib/migration-027-cert-provenance.sql`, all review amendments in:
- `effective_halal_level` GENERATED keys off `cert_status='current'` **only**
  (no CURRENT_DATE — immutability); `flip_expired_certs()` daily cron carries
  the time logic.
- cert columns on `places` **and** `places_staging`; `promote_staged_place`
  carries them (full body re-stated from migration 013 + cert fields).
- `CHECK (halal_level BETWEEN 1 AND 3)` — confirmed **0 legacy level-4 rows**.
- `cert_freshness_audit()` for governance (expired-but-Trusted, 120-day
  staleness, trusted-total); daily flip + monthly §8.5 backstop.
- Dry-run gates + rollback inline. **App read-path flips to
  `effective_halal_level` only after your audit, via OTA** (027 is additive;
  until the flip, `effective` is written-but-unread, so rollback is invisible).

## Task 2 — MUIS harvest

Validated flow automated: GET page → scrape fresh `__RequestVerificationToken`
+ antiforgery cookie → `POST /api/halal/establishments {"text": …}`, throttled
~7/sec, food-service filter (`subSchemeText` ∈ Restaurant / Hawker /
Snack Bar-Bakery — Central Kitchen / Catering / Beverage-only excluded).

**Two findings that shape the program:**
1. **Expiry: MUIS records carry no expiry field** (name, cert id, scheme,
   address, postal only; no per-record detail endpoint found). → Singapore
   rows take `cert_expires NULL` + the **120-day `cert_last_checked`
   staleness path** from 027. (THIDA/CICOT publish expiry; SG doesn't.)
2. **The search endpoint hard-caps at 200 results/query with no working
   pagination** (start/length don't advance; scheme filter doesn't narrow).
   So **exhaustive enumeration of the full MUIS register is NOT feasible via
   this API** — which is fine for reconciliation (targeted per-place search,
   below) but blocks Task 4 (see there).

## Task 3 — Reconciliation vs our 257 SG places → the audit list

Per-place: MUIS name search → **postal-exact + name-agreement** for high
confidence (SG postals are building-precise). Result:

| Tier | Count | Disposition |
|---|---|---|
| **HIGH** (postal + name agree) | **51** | auto-promote candidates (your audit) |
| SHARED-POSTAL ambiguous | 12 | review queue |
| NAME-ONLY (no postal match) | 4 | review queue |
| Not certified | 190 | stay Reported (Coconut Club, Zam Zam correctly here) |

**A false-positive class I caught and fixed mid-pilot:** my first pass used
postal-exact **alone** as high-confidence. In Singapore a mall/food-court is
one postal shared by many stalls, so "Kopitiam" matched a certified
"BERADIK WESTERN" and "My Kampung" matched a "Chicken Rice stall" — same
building, different business. Requiring postal **and** name agreement moved
those 12 to review. Auto-promoting a place as another stall's cert is exactly
the false-Trusted failure the program exists to prevent — so this gate is
load-bearing, not cosmetic. Closure already handled: reconciliation runs on
`is_active` rows, and this session's `business_status` sweep already
deactivated the closed ones, so no certified-but-closed slips through.

**On promotion (post-027, post-audit):** each HIGH row gets
`cert_body='MUIS', cert_id, scheme, cert_status='current'`,
`cert_last_checked=now()` → `effective_halal_level` computes to 4. **~20% of
Singapore (51/257) becomes genuinely Trusted** — from zero. First clean audit
→ auto-promotion becomes standing for MUIS-class primary registers.

## Task 4 — Bonus supply: NOT feasible via this API (honest finding)

Unmatched MUIS food-service = new pre-certified supply — but the 200-cap +
no-pagination (Task 2) means the full register can't be enumerated through
the search endpoint, so a clean "count" isn't achievable this way.
**Recommendation:** check for a **bulk dataset** — MUIS/data.gov.sg often
publish certified-establishment lists as a downloadable CSV/API; that's the
right source for bonus supply (and for a future full-register diff), not
scraping a capped search box. Flagging as a short follow-on, not a pilot
blocker.

## Task 5 — Template descriptions (sample gate → your eyeball)

Deterministic template from owned fields only (price · cuisine · place_type ·
neighbourhood-or-Singapore), **no cert claim in prose** — the trust badge
conveys certification, which keeps every description lint-clean regardless of
level. 20 varied samples generated, **20/20 pass the WS4 lint.** Examples:
- Zam Zam → "A budget-friendly Indian restaurant in Kampong Glam."
- The Dim Sum Place → "A mid-range Chinese restaurant in Kampong Glam."
- Tarboush → "A Middle Eastern restaurant in Bugis."

Two trivial polish fixes before catalog-wide rollout (not blockers): a/an
handling ("An Indian"), lowercase common-noun cuisines ("dessert"/"seafood").
Underlying `cuisine_type` data has some noise (a couple mis-tagged 'dessert')
— template surfaces it but doesn't create it. **Your call: approve the
approach → I apply the polish + backfill catalog-wide.**

## Task 6 — Governance numbers (pilot-end)

- **Trusted (level 4): 0 now → 51 on promotion** (3.5% of catalog, 20% of SG).
- **Sourced descriptions: 0 now → ~100%** once the template rolls (currently
  the catalog has zero descriptions post-purge — clean slate).
- **Closure catches this program: 30** (26 permanent + 4 from the stale-id
  review), catalog 1,501 → 1,471.
- **expired-but-Trusted: 0** — maintained by 027's daily flip; the freshness
  audit function is wired for the weekly read.

## Your gates to make Singapore Trusted

1. **Apply migration 027** (SQL Editor; run the dry-run gates first).
2. **Audit `pilot-sg-muis-audit-list.md`** — the 51 auto-promote candidates +
   the 16-row review queue. On your clean pass I stage + promote them (cert
   provenance recorded), then flip the app read-path via OTA.
3. **Approve the description approach** → polish + catalog-wide backfill.
4. Optional: point me at a MUIS/data.gov.sg bulk dataset for bonus supply.

When 1–2 land, "Trusted" means something in Singapore for the first time —
and the loop (harvest → postal+name reconcile → audit → promote → 027 expiry
lifecycle) is the template for CICOT (Bangkok, pairs with the queued sweep)
and THIDA (Taipei).


---

## LIVE OUTCOME (2026-08-09, post-approval)

- **027 applied + verified** on prod: all cert columns + `effective_halal_level`
  present, 0 effective≠community mismatches on apply, `cert_freshness_audit()`
  + `flip_expired_certs()` live, daily cron scheduled.
- **51 SG places promoted to MUIS Trusted** (audit approved): `cert_body='MUIS'`,
  cert id, `cert_status='current'`. `cert_freshness_audit()` → trusted_total=51,
  **expired_but_trusted=0**. Community level untouched (still 1) — Trusted comes
  from the computed effective level, and falls back if a cert ever lapses.
- **App read-path flipped** to `effective_halal_level` (badge, detail label +
  explainer, map marker) — commit + OTA. 101 tests green; flows through every
  fetch path (nearby_places is SETOF places). halal_level retained for
  community-progress copy + analytics.
- **Descriptions: 0 → 1,471 (100%)** — deterministic template, a/an + lowercase
  polish applied, **lint-clean by construction** (pre-checked all 1,471; the
  lint itself now paginates for full coverage).
- **Shipped:** preview OTA `d3bcf6bc`, production OTA `b581d202`.

**Singapore is the first city where "Trusted" means something** — 51 places
backed by auditable, lapsing-capable MUIS provenance, from zero. The loop
(fresh-token harvest → postal+name reconcile → human audit → promote → 027
expiry lifecycle) is proven and templates to CICOT (Bangkok) and THIDA (Taipei).
**Correction to the Task-4 finding:** the search API caps at 200/query, but a
systematic character sweep DOES enumerate the register (36 single-char queries
surfaced 1,051 unique establishments, deduped by cert number). So MUIS-first
ingestion (start from the register, geocode via Google, publish as Trusted) is
feasible — proposed separately (`planning/muis-first-sweep-proposal.md`) as a
scoped, curation-preserving Restaurant-only sweep, not a full-register dump.
