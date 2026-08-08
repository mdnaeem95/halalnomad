# Migration 027 — DESIGN DOC (not the migration)

**Status:** design for PM review. Becomes `migration-027-cert-provenance.sql`
only after sign-off. **Numbering confirmed:** 024 (trip RPCs) + 025
(add-place no-op) are latest applied; 026 stays **reserved for the M4 share
model**; this takes **027**. Part of the data-accuracy program
(`planning/data-accuracy-plan.md`).

## Purpose

Make level 4 (Trusted) mean "a certification body says so, and the cert is
current" — storable, auditable, and **reversible when a cert lapses**. Today
`halal_level` is a static integer with no cert metadata, so a Trusted badge
could never be trusted to still be true. This adds cert provenance + a
computed effective level so Trusted can rise on a real cert and fall when it
expires — the same trust integrity the Coconut Club incident was about, made
durable.

## Schema changes

### 1. Cert provenance columns on `places`

```sql
ALTER TABLE places
  ADD COLUMN cert_body        text,        -- 'MUIS' | 'CICOT' | 'THIDA' | 'KMF' | 'HAI_KOREA' | ...
  ADD COLUMN cert_id          text,        -- the certificate number as published by the body
  ADD COLUMN cert_issued      date,        -- where the body publishes it
  ADD COLUMN cert_expires     date,        -- NULLABLE — populated only where the body publishes expiry
                                           --   (MUIS/THIDA/CICOT do; others don't → rely on last_checked)
  ADD COLUMN cert_last_checked timestamptz, -- when we last reconciled this row against the body
  ADD COLUMN cert_status      text          -- 'current' | 'expired' | 'revoked' | 'unverified'
    CHECK (cert_status IN ('current','expired','revoked','unverified'));
```

- **Community signal stays where it is** (`verification_count`, the
  `verifications` table). Cert metadata is additive and independent.
- `cert_body + cert_id` are the natural key for a cert; store the body's
  published fields verbatim + our `cert_last_checked` audit stamp.

### 2. Community level becomes explicit

The existing `halal_level` column is overloaded — it's both "what the
community earned" (auto-upgrades to 2 at `verification_count >= 3`) and "the
displayed level." Split the concepts:

- Keep `halal_level` as the **community-earned** level (1–3; existing
  triggers/logic unchanged — this is the max a community can reach; level 4
  is cert-only per doctrine).
- Add a **computed effective level** the app reads:

```sql
-- max(cert-level-if-current, community level). A current cert = 4; an
-- expired/revoked/absent cert contributes 0, so the row falls back to the
-- community level, never below it.
ALTER TABLE places
  ADD COLUMN effective_halal_level int
  GENERATED ALWAYS AS (
    GREATEST(
      halal_level,
      CASE WHEN cert_status = 'current'
             AND (cert_expires IS NULL OR cert_expires >= CURRENT_DATE)
           THEN 4 ELSE 0 END
    )
  ) STORED;
```

**Decision for PM:** a `GENERATED` column recomputes on write but NOT on the
mere passage of time — a cert that expires "tomorrow" won't flip until the
row is next written. Two options:
- **(a) Generated column + a daily cron** (reuse the §8.5 audit cron) that
  touches rows crossing `cert_expires` and re-stamps `cert_status='expired'`.
  Recommended — cheap, and the cron is the same place the cert-freshness
  alert lives.
- (b) A plain column maintained entirely by the reconciliation job (no
  GENERATED). Simpler schema, more app-side responsibility.
Recommend (a): the DB expresses the invariant; the cron handles time.

### 3. App read path

The app switches its trust-level reads from `halal_level` to
`effective_halal_level` (one-line change per read site; the badge component
already takes a level int). `halal_level` remains for the community-progress
UI ("2 more confirmations to Community-Verified").

## How levels move (the lifecycle this enables)

| Event | Effect |
|---|---|
| High-confidence primary-register match, cert current | `cert_* ` set, `cert_status='current'` → effective 4 |
| Cert `expires` date passes (cron) | `cert_status='expired'` → effective falls to community level |
| Body publishes revocation / expired-list (THIDA) | `cert_status='revoked'` → same fallback |
| Re-check finds cert renewed | `cert_status='current'`, new `cert_expires` → 4 again |
| Never matched to any register | `cert_status` NULL/'unverified' → effective = community level (today's behaviour) |

## Reconciliation ownership (not schema, but the contract 027 serves)

- Auto-set `cert_*` only from a **primary register**, **high-confidence match**
  (place_id or exact name+addr+geo), cert current, `business_status` open.
- Secondary/citing sources → the `cert_candidate` human queue (Seoul lesson).
- Pilot's first auto-promotions are 100% human-audited before automation
  becomes standing (per the PM ADR).

## Dry-run + rollback plan (standing rule)

**Dry-run (before commit):**
1. Run the `ALTER`s in a transaction against a prod **branch/backup**, not
   prod; confirm the GENERATED column materialises and existing rows compute
   `effective = halal_level` (all NULL cert → no change to any displayed
   level — zero user-visible impact on apply).
2. `SELECT count(*)` where `effective_halal_level <> halal_level` → must be
   **0** immediately post-migration (nothing is certified yet).
3. Verify existing trust triggers still fire (community upgrade to 2).

**Rollback:**
```sql
ALTER TABLE places
  DROP COLUMN effective_halal_level,
  DROP COLUMN cert_status, DROP COLUMN cert_last_checked,
  DROP COLUMN cert_expires, DROP COLUMN cert_issued,
  DROP COLUMN cert_id, DROP COLUMN cert_body;
```
All additive columns; drop is clean because the app read-path switch ships
**after** the migration is verified (deploy order: migrate → verify →
flip app reads). Until the app flips, `effective_halal_level` is written but
unread, so a rollback pre-flip is invisible.

## Open decisions for PM

1. GENERATED-column + cron (recommended) vs job-maintained plain column.
2. Whether `cert_expires IS NULL` (body doesn't publish expiry) should force
   a shorter re-check cadence than the quarterly default.
3. Confirm `places_staging` needs the same cert columns (so a cert match found
   at scrape time carries through promotion) — recommend **yes**, mirror the
   columns on staging and have `promote_staged_place` copy them.
