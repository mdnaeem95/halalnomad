# Dev report — Seoul seed sweep (cuisine keywords + KMF harvest)

Date: 2026-07-30. Responds to: the 2026-07-28 sweep brief. Status: **both
buckets complete + OSM sized — 82 rows staged awaiting Sani's review pass**
(62 pending + 20 auto-approved, from a 94-active / 250-target baseline).

## Bucket 1 — cuisine-keyword sweep

**Yields:** 488 fetched → 312 in-batch dups → 98 already-staged → **0 leaked
past the place_id guard into dup_in_places** → **78 staged**. Auto-approve:
**20** (explicit halal markers). Auto-reject: **0** (no blacklisted chains).
**58 to the manual queue.**

Per keyword: turkish **32** · indonesian **20** · halal 12 · north indian 9
· malay 4 · uyghur 1 · pakistani 0. The cuisine-keyword thesis holds a 4th
time — the base "halal" sweep alone would have missed 85% of the yield.
(Auto-approve rate 26% vs the usual 50–70% — expected: cuisine-surfaced
places carry fewer explicit halal markers; that's why they need the sweep.)

**Geo bleed: zero.** All 78 new rows carry Seoul addresses (checked pending
+ approved separately). No Incheon/Gyeonggi reclass list needed — the 2.5 km
district radii stay comfortably inside the city.

## Seoul data-shape findings (standing per-city rule)

- `name_local` is null on **91 of 94** live Seoul rows — the scraper
  requests `language=en` and never populates local fields (by design, all
  cities). Korean script instead leaks into `_en` when Google lacks a
  romanized form: **38/94 addresses and 10/94 names** contain Hangul in
  `_en` fields. Not new breakage (batch-1 landed identically), and dedup is
  place_id-anchored so matching is unaffected — but it's the Taipei-class
  shape, and a `name_local` backfill pass for KR/JP would fix display +
  fuzzy-matching quality in one shot. Backlog candidate, PM call.
- Typographic apostrophes: 1 occurrence (no Taipei-style epidemic).
- **Classifier: no marker additions needed** — `할랄|이슬람|무슬림` already
  present, and the Muslim-friendly self-labels the brief listed
  (`무슬림 친화`, `무슬림 식당`) are substring-covered by `무슬림`.

## Bucket 2 — KMF cert-directory harvest (first cert-body run)

**KMF's own register is not publicly accessible** (the koreaislam.org halal
portal is a login-walled application system; haikorea.org hosts forms only).
Harvest source used: the **City of Seoul's official listing** (Visit Seoul,
"KMF Halal-Certified" category) — 10 Seoul entries, listing URL + harvest
date recorded in every row's provenance. Consequence for review: level-4
promotion should confirm certification per-row (in-store certificate /
KMF confirmation), since our source *cites* KMF rather than *being* KMF.

Disposition of the 10 listing entries after dedup (place_id exact →
substring → fuzzy+proximity):

- **4 staged new** (`source = kmf_cert_via_visitseoul`, level 1, flagged
  `cert_candidate` in `search_query`): Kervan COEX, Kervan Express GFC
  (address-geocoded — Google has no distinct listing; confirm it exists),
  Istanbul Delight, Salam Restaurant (possibly related to our existing
  SALAM EXPRESS — confirm distinct).
- **5 already ours → cert_candidate flags for review** (no re-staging):
  EID Halal Korean Food (+ its Hongdae branch — confirm cert scope), Kervan
  Turkish Restaurant Halal ITAEWON, Mr.Kebab, Makan Halal Restaurant, and
  Jipbab Kimseonseang = our just-staged "Halal Korean Restaurant (Home
  Cooked Meal Gim Soensaeng" (caught by place_id, not name — transliteration
  gap the fuzzy layer can't see).
- **1 existence-verify**: Bombay Grill — its listed address (11 Usadan-ro
  10-gil) is occupied by Zaiqa Restaurant in our data; either stale listing
  or shared building. Not staged; needs a human look. (OSM corroborates a
  봄베그릴 existed.)

**Trust rule honored:** everything staged at level 1; zero level-4
assignments; promotion is Sani's deliberate per-row call.

Review-queue helper — the cert candidates in staging:

```sql
SELECT id, name_en, address_en, search_query
FROM places_staging
WHERE city = 'seoul' AND search_query ILIKE '%cert_candidate%';
```

## OSM sizing (Bucket 3)

Overpass `diet:halal=yes|only` across Seoul: **10 elements** (all named),
most already ours (Busan Jib, Murree, Bombay Grill…). Far under the 30
threshold → **OSM is dead for Korea**, matching TW + JP. Recorded; skipped.

## State + handoff

Staging for Seoul: **62 pending / 20 approved / 27 rejected / 91 promoted**
(200 total). Sani's review hour is the bottleneck as predicted; after
review → `promote.py run --city seoul` → production OTA bump per runbook.
Throughput + the new active count feed the Sep 27 re-eval, and the
neighbourhood dictionary (PM-owed) unblocks the backfill after promotion.

Cost: one keyword sweep (~$5–10 Google API) + 6 Find Place/Geocoding calls.

## Outcome (same day — review + promotion complete)

Sani reviewed all 82: **26 approved → promoted. Seoul 94 → 120 active**
(target 250; ~48%). Approval rate 58.5% — strict, and vindicated: **3 of the
4 newly-listed KMF entries were permanently closed** (Istanbul Delight,
Salam Restaurant, Kervan Express GFC; only Kervan COEX survived). Add to the
Naritaya file: official tourism listings go stale; future directory
harvests should check Google `business_status` per-row at harvest time —
cheap and it would have pre-flagged all three. Production OTA `9188a34f`
published (data revalidation); /cities page updated 94→120, totals →1,501,
deployed. Cert-candidate flags on the 7 live rows await deliberate level-4
review; Bombay Grill's existence question stays open. Throughput number
for Sep 27: one sweep session + one review hour ≈ **+26 net places**.
