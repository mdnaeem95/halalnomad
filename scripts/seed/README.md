# scripts/seed

Pipeline that populates `places` with curated halal restaurant data
scraped from Google Places (and, later, halal certification body
directories). Lives outside the RN app — Python tooling, run from this
directory.

> **Read first:** `planning/data-sourcing-strategy.md` (gitignored,
> local) — explains why this exists, target cities, legal/ethical rules,
> and order-of-operations.

## How the pipeline works

```
   Google Places API
          │
          ▼
   google_places.py  ──────►  places_staging   (Supabase, RLS-locked)
                                    │
                                    │  human review in Supabase Studio
                                    │  set reviewed=true, approved=true|false
                                    ▼
                              promote.py
                                    │
                                    ▼
                              places  (live, app reads from here)
```

The scraper writes raw rows; you spend the time reviewing them
manually; the promote script moves approved ones into the live table.
Halal trust is earned, not asserted — every staged row defaults to
`halal_level: 1` (Reported).

## One-time setup

### 1. Run migration 007

In Supabase SQL Editor, paste and run
`app/src/lib/migration-007-places-staging.sql`. Creates:

- `places_staging` table (RLS-locked, service role only)
- Adds `places.sources` JSONB column for provenance
- `promote_staged_place(staging_id, user_id)` RPC

### 2. Get a Google Places API key

In Google Cloud Console (same project that holds your Maps SDK key):

1. Enable **Places API** (the legacy/web service one — not the new
   "Places API (New)" — `google_places.py` uses the legacy endpoints).
2. Create or reuse an API key.
3. Restrict it to "Places API" only (security).

### 3. Create a SEED_USER_ID

Pick a Supabase user UUID to be marked as `added_by` for promoted
places. Either:

- Use the demo reviewer account UUID (`reviewer@halalnomad.app`), or
- Create a dedicated `seed-bot@halalnomad.app` account in Supabase Auth.

Doesn't matter much for now since `added_by` is just attribution.

### 4. Configure .env

```bash
cd scripts/seed
cp .env.example .env
# Fill in SUPABASE_SERVICE_ROLE_KEY, GOOGLE_PLACES_API_KEY, SEED_USER_ID
```

### 5. Install Python deps

```bash
# Recommended: uv (fast, modern)
brew install uv  # if not installed
uv sync

# Or with pip:
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
```

## Per-city runbook

Use this exact sequence for every new city. Capture the breakdown at
each stage — that's how we'll know whether the auto-rules are getting
better or worse over time.

Replace `tokyo` with the city you're working on.

### 1. Scrape

```bash
python google_places.py scrape tokyo
```

Typical: ~150-400 staged rows per tier-1 city, 5-10 minutes,
~$5-10 in API. The summary table at the end tells you fetched / dup /
staged.

### 2. Snapshot the initial state

```bash
python report.py breakdown tokyo
```

You'll see all rows as `pending`. Save this output (paste into a notes
file). This is the baseline.

### 3. Auto-approve known halal markers

Preview first:

```bash
python report.py auto-approve tokyo --dry-run
```

If the count looks right (typically 50-70% of pending), apply:

```bash
python report.py auto-approve tokyo
```

### 4. Auto-reject known non-halal chains

```bash
python report.py auto-reject tokyo --dry-run
python report.py auto-reject tokyo
```

### 5. Snapshot post-auto state

```bash
python report.py breakdown tokyo
```

Whatever's still `pending` is your manual queue. Paste this output
alongside the baseline so we can see how much auto-action handled.

### 6. Manual review of remaining pending rows

In Supabase SQL Editor:

```sql
SELECT id, name_en, address_en, cuisine_type, source_url
FROM places_staging
WHERE city = 'tokyo' AND reviewed = false
ORDER BY created_at;
```

For each: open `source_url` in a new tab, look for halal certificate /
Arabic signage / Muslim-friendly signal. 5 seconds per row.

```sql
-- Approve one
UPDATE places_staging
SET reviewed = true, approved = true
WHERE id = '<uuid>';

-- Reject with reason
UPDATE places_staging
SET reviewed = true, approved = false, rejected_reason = 'no halal signal'
WHERE id = '<uuid>';

-- Bulk-reject anything still pending after manual pass (catch-all)
UPDATE places_staging
SET reviewed = true, approved = false, rejected_reason = 'ambiguous, defer to community'
WHERE city = 'tokyo' AND reviewed = false;
```

When done: nothing should still be `pending`.

### 7. Snapshot final review state

```bash
python report.py breakdown tokyo
```

You'll see splits across `approved` / `rejected`. Total approval rate
should be 70-95% depending on how strict you were.

### 8. Promote into the live places table

```bash
python promote.py status --city tokyo
python promote.py run --city tokyo --dry-run
python promote.py run --city tokyo
```

### 9. Push an OTA so the app picks up the new data

```bash
cd ../../app
npx eas-cli update --branch production --platform ios --message "Tokyo seed batch 1"
```

(JS-only OTA — the data lives server-side, but bumping the OTA
revalidates query caches faster on existing installs.)

### 10. Final breakdown (optional)

```bash
python report.py breakdown tokyo
```

`promoted` count should equal `approved` count. If not, some rows
failed promotion — investigate before moving on (likely missing
coordinates or some other data issue surfaced by the RPC).

### Per-city template to capture in your notes

```
City: <name>
Date: <YYYY-MM-DD>
Scrape time: <minutes>, API cost: <USD>

Stage 1 — fetched / staged: <X> / <Y>     (dup_in_batch: <Z>)
Stage 2 — pending after auto-approve: <X> (approved: <Y>)
Stage 3 — pending after auto-reject:  <X> (rejected: <Y>)
Stage 4 — manual review: <X>              (approved: <Y>, rejected: <Z>)
Stage 5 — promoted into places: <X>

Cuisine breakdown of approved:
  <copy from `report.py breakdown` output>

Notes / surprises / regex tweaks needed:
  <free text>
```

## Tuning the auto-rules over time

The keyword regexes live in `report.py` constants:

- `APPROVE_NAME_REGEX` — name patterns that auto-approve
- `APPROVE_CUISINES` — cuisine types that auto-approve
- `REJECT_NAME_REGEX` — chains that auto-reject

After every 2-3 cities, look at what slipped through to manual review
and ask: was there a pattern I could've added? Add it to the constant.
Conservative bias — false-approves are worse than false-rejects since
they pollute the live data and we'd rely on community to catch them.

## Multi-city run

Once you're confident in the pattern:

```bash
for city in tokyo osaka kyoto seoul bangkok singapore taipei; do
  python google_places.py scrape "$city"
done
```

Then review batch-by-batch — much more manageable than mixing cities.

## Adding a new source

The pipeline is designed to take other sources, not just Google Places.
Adding e.g. a JHA (Japan Halal Association) directory scraper:

1. New file `jha.py` next to `google_places.py`
2. Implement scraping (likely BeautifulSoup against their HTML directory)
3. Each row inserted with `source = 'jha'`, `proposed_halal_level = 4`
   (cert body = trusted), `certification_body = 'JHA'`
4. The promote.py and review SQL are unchanged

Sources we want eventually (priority order):

- **MUIS** (Singapore) — official halal certification list. Highest trust.
- **JHA** (Japan Halal Association) — Tokyo, Osaka coverage.
- **KMF** (Korea Muslim Federation) — Seoul certifications.
- **CICOT** / **Halal Foundation** (Thailand) — Bangkok.
- **THIDA** (Taiwan).

Each gives `halal_level: 4` quality. Then enrichment passes can
cross-reference Google Places staging entries against these to upgrade
their proposed levels before review.

## Costs to watch

Google Places legacy pricing (April 2026):

| Endpoint              | $/1k requests |
| --------------------- | ------------- |
| Nearby Search         | $32           |
| Place Details (basic) | $17           |

Per-city budget: ~$3-7. Full tier-1 sweep: under $50. Set a daily
budget alert in Google Cloud Console as a safety net.

## Failure modes & gotchas

- **API key restrictions too tight.** If you restrict by HTTP referrer
  (which makes sense for the Maps key in app.json) — the seed key
  needs different restrictions ("None" or "IP" — never expose this in
  client code).
- **Service role key in .env.** Never commit, never put in app code.
  This file's `.gitignore` already excludes `.env`.
- **Dedup misses obvious dups.** The 80m / 85% fuzzy ratio is a
  heuristic — review carefully on the first run. Tune in `google_places.py`
  if needed.
- **Stale `next_page_token`.** Google requires ~2s between requesting a
  next-page token and using it. The script sleeps 2s automatically, but
  on slow networks you may see `INVALID_REQUEST` — re-run that city.
- **Hitting your API quota.** Default Google quotas are generous
  (~100k requests/day) but can be lowered for cost control. If you set
  a tight quota, the script raises and stops — fine, just bump the quota.

## When does this script retire?

Eventually, community contributions exceed seed-data flow and we
mostly stop scraping. Likely milestone: 50K MAU with 3+ verifications
per place. Until then, refresh tier-1 cities monthly to catch new
openings + closures.
