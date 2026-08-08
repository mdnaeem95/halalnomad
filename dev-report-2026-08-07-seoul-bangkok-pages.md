# Dev report — halalnomad.travel/seoul + /bangkok (Sprint 03, one pass)

Date: 2026-08-07. Responds to: the same-day dev brief (heroes approved
verbatim). Status: **both pages live** — deploy commit `a5b407b`, built and
shipped in one pass off the /tokyo template. ~2h incl. data verification.

## Live values used (all re-queried at build)

- **/seoul [N] = 120** · **/bangkok [N] = 143** · catalog total 1,501
  (unchanged — /cities needed no count edits, only links).
- Both title/meta/H1/JSON-LD carry the live counts; heroes are the approved
  drafts verbatim with `[N]` substituted.

## Top-10s as rendered (all "Reported" — cert review hadn't landed)

A small upgrade on the spec's expectation: **both cities now lead with
genuinely community-confirmed places** (v1 confirmations landed since the
spec was written) — one more confirmation than /tokyo launched with.

- **Seoul:** Kervan Turkish 케르반 (1 confirmation) · IFTAR (1 confirmation)
  · EID Halal Korean Food · Makan 마칸 · Busan Jib 부산집 · Kervan COEX ·
  Chakraa Indian · 양인환대 북창 City Hall Halal BBQ · Alpedo · Namsan
  Garden Halal BBQ. (Korean cuisine deliberately weighted ×4 — it's the
  hero's "rarer prize" thesis made visible.)
- **Bangkok:** Saman Islam ร้านสะมานอิสลาม (1 confirmation) · Yusup Pochana
  ยูซุป โภชนา (1 confirmation) · Home Cuisine Islamic · Sara-Jane's ·
  Phrigkiao (Siam Sq) · Yellow Rice ข้าวเหลือง · Usman (Soi 22) · Yana
  (MBK) · Sunshine · New Al Makkah. (Thai-Muslim weighted — the hero's
  "not an import" thesis.)

When Sani's cert review promotes any flagged Seoul rows to Trusted, the
badges update at the next page build — zero rework, as the brief planned.

## Neighbourhood blocks — one finding Growth should see

All example places were **address-verified in the DB** before naming
(Myeongdong and Siam/MBK turned out rich; Dongdaemun carries its two real
anchors). But: **Ramkhamhaeng — the approved hero's "the real thing"
neighbourhood — has ZERO places among our 143.** Bangkok's own Thai-Muslim
heartland was never in the seed sweep's district set. Handled honestly on
the page: the block ships example-free and turns the gap into a
contribute-here call ("the neighbourhood where every confirmation counts
most"). **Recommendation: add a Ramkhamhaeng/Hua Mak centroid to the
Bangkok district config and run a top-up sweep** — it would likely be the
highest-yield-per-dollar sweep available (dense, halal-by-default, and now
publicly promised by our own page).

Itaewon guardrail honored: food-street framing only, zero mosque/prayer
content (including in example selection).

## Plumbing

- `/cities`: Seoul + Bangkok flipped to links; lede now "Tokyo, Seoul and
  Bangkok are live now". `sitemap.xml` +2 (lastmod 2026-08-07).
- All verified live post-deploy (200s, content, links, sitemap entries).
- **GSC:** sitemap resubmitted (Sani, Aug 7 — the read-only service
  account can't do this via API; 403 confirmed as designed). Per-URL
  indexing requests for `/seoul` and `/bangkok` — Sani's remaining ~30s.
- **$pageview: CONFIRMED on both pages** in PostHog EU (real browser
  visits, Aug 7) — the analytics acceptance bar is closed.
- Post-launch IA fix (same day, commit `e914426`): the homepage navbar's
  one-off "Tokyo" link (a relic of the single-page era) replaced by the
  scalable structure — navbar carries the "Cities" hub only; the homepage
  city chips (Tokyo/Seoul/Bangkok now all links) and the footer carry the
  per-city links. Chips for the other ten cities stay plain until their
  pages exist (no-404s rule).

## Measurement handoff

Weekly GSC pull now covers 3 city pages automatically. Growth owns the
Osaka/Kyoto go-signal (per their spec: /tokyo position <20 OR any page
compounding impressions WoW — the latter was already true at last read).
