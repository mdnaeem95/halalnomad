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

## Daily workflow

### Scrape one city

```bash
# Smoke test on 2 districts first
python google_places.py scrape tokyo --max-districts 2 --dry-run

# Real run
python google_places.py scrape tokyo
```

Typical output: ~150-300 raw rows per tier-1 city, takes 5-10 minutes,
costs <$5 in API calls.

### Review in Supabase Studio

```sql
-- Pending review
SELECT id, name_en, address_en, latitude, longitude, cuisine_type, source_url
FROM places_staging
WHERE city = 'tokyo' AND reviewed = false
ORDER BY created_at;

-- Approve a row
UPDATE places_staging
SET reviewed = true, approved = true
WHERE id = '<uuid>';

-- Reject with reason
UPDATE places_staging
SET reviewed = true, approved = false, rejected_reason = 'not actually halal — only halal-friendly options'
WHERE id = '<uuid>';

-- Bulk-approve a sanity-check region
UPDATE places_staging
SET reviewed = true, approved = true
WHERE city = 'tokyo'
  AND id IN ('uuid-1', 'uuid-2', 'uuid-3', ...);
```

Review heuristic — auto-skip / reject:

- **Reject** if name is generic (e.g. "Cafe", "Restaurant") with no halal
  signal in name or address
- **Reject** if it's a chain that you know isn't halal in this country
  (e.g. McDonald's Japan)
- **Reject** if the address is a residential block with no business
- **Approve** if the name contains "Halal", "Muslim", "Mosque",
  Middle-Eastern/Indian/Pakistani/Indonesian cuisine markers
- **Approve** if `source_url` opens to a Google listing with
  Muslim-friendly photos / certificate visible
- **Defer** (leave unreviewed) if you're not sure — these can pile up
  for a future Ambassador-tier user to handle

Aim for 80%+ approval rate. If you're auto-approving everything, your
keyword filtering is too loose.

### Promote approved rows

```bash
# Show counts first
python promote.py status --city tokyo

# Dry run — see what would happen
python promote.py run --city tokyo --dry-run

# For real
python promote.py run --city tokyo
```

After promote, push an OTA (so any cached app instances refetch):

```bash
cd ../../app
npx eas-cli update --branch production --platform ios --message "Tokyo seed batch 1"
```

(Strictly speaking, the app will pick up new places via TanStack Query
cache invalidation eventually, but a fresh OTA bumps the runtime so
it's a clean break.)

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
