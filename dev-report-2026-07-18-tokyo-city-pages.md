# Dev report — halalnomad.travel/tokyo + /cities (ship confirmation)

Date: 2026-07-18. Responds to: the 2026-07-17 dev brief "SEO city pages,
wiring". Status: **live in production** (commit `a7ebac7`), hero passed by
Sani pre-deploy, both ship gates met.

## Live data used (all queried from Supabase at build)

- **[N] = 181** active Tokyo places.
- Per-ward: **Taitō 49 · Shinjuku 43 · Shibuya 26** — the June snapshot
  (47/40/26) was indeed stale and was not reused. Tokyo is 100% ward-tagged;
  ward counts sum exactly to 181.
- `/cities` (sums exactly to the 1,476 active total): Singapore 265,
  Tokyo 181, Bangkok 143, Phuket 133, Osaka 116, Seoul 94, Hong Kong 93,
  Kyoto 92, Manila 77, Ho Chi Minh City 76, Taipei 73, Chiang Mai 67,
  Hanoi 66. Note: the DB splits Taipei (68) / New Taipei (5); merged as
  "Taipei 73" to keep the 13-city frame.

## The top-10 as rendered

Rule applied: `halal_level` DESC → `verification_count` DESC, max 3 per
ward, cuisine mix. 1. Sekai Cafe Asakusa 世界カフェ 浅草 (Taitō) · 2. Naritaya
Halal Ramen 成田屋 (Taitō) · 3. Gyumon Halal Yakiniku 牛門 (Shinjuku) ·
4. Ayam-Ya アヤムヤ (Shinjuku) · 5. Turkish Restaurant Ankara (Shibuya) ·
6. Diya Indian (Chiyoda) · 7. Halal Wagyu Yakiniku Panga (Taitō) ·
8. Kuta Bali Cafe (Shibuya) · 9. Samarkand Terrace (Shinjuku) ·
10. LUXE Burgers (Chūō).

Three editorial calls Growth should be aware of:

1. **Every Tokyo place is currently trust level 1** — all ten badges read
   "Reported" (Sekai Cafe, at #1, is the only place in the city with a
   traveller confirmation). The hero's "from Reported to Trusted" framing
   holds, but the page shows no green badges today; that changes only as
   community verifications land.
2. Below #1 the ordering rule is a 180-way tie, so positions 2–10 are the
   brief's "hand-adjust" clause: featured-ward coverage, local-script names
   where they exist, cuisine spread.
3. Six selected places have `cuisine_type = 'other'` in the DB; the rows
   show descriptors evident from the places' own names (Wagyu, Uyghur,
   Central Asian, Cafe) instead of a literal "Other".

## PostHog on web: was absent — newly wired, with proof

The site had no analytics at all. Added `web/analytics.js` (official
snippet) on **all six pages**, hard-pinned to the EU ingest host with a
warning comment about the silent US-fallback failure class. Two-stage
proof: (1) preflight event POSTed with the site key → accepted and
**seen in PostHog EU** via the query API; (2) post-deploy, Sani's real
Chrome visit produced `$pageview` / `$autocapture` / `$web_vitals` /
`$pageleave` from `/tokyo`, `/cities`, and `/` — all visible in project
191007. Operational note: query-side ingestion lags ~6 minutes.

## GSC

Property `halalnomad.travel` verified (Domain property via Cloudflare DNS
TXT), `sitemap.xml` submitted (5 URLs), `/tokyo` indexing requested —
completed by Sani 2026-07-18. Performance data starts appearing ~2 days
after setup, so the first meaningful weekly impressions check is w/c
July 20.

## Everything else in the deploy

- `sitemap.xml` **created** (site had none): /, /tokyo, /cities, /privacy,
  /terms. `robots.txt` added pointing at it (and excluding /auth/).
- Homepage: nav + footer + the Tokyo city chip now link to the new pages;
  the stale launch-era "1,361" count reads **"1,470+"**.
- /tokyo ships `WebPage` + `ItemList` JSON-LD, self-canonical, no FAQ
  markup, no outbound links in the list, Inter-only, sentence case,
  zero emoji, `.travel` links only. Ward sections are on-page anchors —
  no `/tokyo/<ward>` subpages exist or are linked.

Nothing further is on dev for this; Growth measures GSC impressions weekly.
