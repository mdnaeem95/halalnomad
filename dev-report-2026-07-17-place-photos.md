# Dev report — display-time Google place photos (spike + build)

Date: 2026-07-17. Responds to: `dev-brief-2026-07-17-place-photos-spike.md`.
Status: **spike complete, gate decision made (Option A: cap-and-degrade), built,
validated on staging, live on the preview channel.** Prod devices untouched.

---

## Part 1 — Spike: the six answers

**1. Pricing + free tier.** Billing splits into two calls with very different
economics. The metadata call (Place Details, FieldMask `id,photos`) lands in
the *Essentials IDs-Only* SKU: **$0.00, unlimited** — discovering whether a
place has photos is free at any scale. The photo image itself bills the
*Place Details Photos* SKU (Enterprise tier): **~$7.00/1,000 with only 1,000
free/month**. Verified against our account: Place Details Pro shows $17/1k
(that's the existing Add Place autocomplete call, unaffected), Photos $7/1k.

Load models: **(a) current traffic** — live PostHog showed ~12–25
place-detail opens/month (Jun: 11 views / 2 users; Jul-to-17th: 12 / 3),
about **1–2% of the free tier**: clean pass. **(b) 2,000 opens/month** —
~2,000–2,400 media requests ≈ **2× the free tier** (~$7–10/mo uncapped):
fails the "comfortably inside free tier" gate. Decision (Sani): **Option A,
cap-and-degrade** — cap at the free tier; if/when opens approach
~1,000/month, that traffic itself is the trigger to either fund ~$7–10/mo or
prioritise the community photo pipeline.

**2. Quota caps: enforceable — gate passed.** Budgets only alert; quota caps
hard-refuse. Places API (New) quotas are **per-method**, so the photos method
is capped without touching autocomplete/details. Now live in console:
**30/day photos cap + low-threshold budget alert** (GetPhotoMedia per-minute
is at 600 — not a constraint).

**3. API surface.** The seed pipeline is on the legacy API and never captured
photo refs — nothing reusable. The app already talks to Places API (New) v1
for autocomplete, so the photo flow reuses that surface: stored `place_id`
(present client-side via `sources[].source_id`; **1,458 of 1,474 zero-photo
places = 98.9% coverage**) → details with `id,photos` → media request with
`skipHttpRedirect` → short-lived `googleusercontent` URI rendered by
expo-image *without our key attached*. Legacy-era seeded place_ids verified
working against v1.

**4. Key architecture: client key — proxy declined (correcting the PM
default).** The console per-method cap already provides the same $0 guarantee
a proxy would, the key already ships in the binary for autocomplete + native
maps, and the media images themselves load keyless. A proxy adds latency on
our hottest screen and a moving part, for no additional billing safety.
Residual risk is availability-only (a scraped key could burn the daily cap) —
that's the tell to revisit. Key already has API restrictions incl. Places API
(New); no console change was needed for the feature.

**5. Session-only caching: implemented — and it required a real fix.** The
query persister previously wrote *every* query to AsyncStorage; a
`shouldDehydrateQuery` filter now excludes the photo query family, making
photo data memory-only and session-scoped. Reinforced by Google's own
behavior: photo names are per-request tokens and "can expire," so persistence
would be broken as well as prohibited.

**6. Attribution (per current policy).** Author credit on every image (name +
avatar, tappable through to their Google Maps profile) plus Google
attribution off-map ("Google Maps" text is acceptable where space-limited),
never cropped, altered, or obscured. Implemented as a bottom strip on each
photo. No labels/categories of ours on any Google-sourced image.

---

## Part 2 — Build: delivered behaviour

- Zero-photo places only; community `photos[]` always wins and fully
  suppresses the Google layer.
- 1 hero media request on place open; up to 2 thumbnails behind an explicit
  tap on a **"+N" chip** (added after staging feedback — an unmarked tappable
  hero wasn't discoverable). Max 3 media requests per engaged view, 1 per
  drive-by view, 0 speculative.
- No Google place_id / no Google photos / any failure → today's no-photo
  layout. No spinners, no error states, ever.
- Offline: no fetch, no cached fallback, placeholder as today.
- A11y: "Photo of {name}, from Google" labels, 44pt targets.
- JS-only, shipped as OTA on runtime 1.1.0 → **preview channel only**; prod
  devices are on 1.0.0 binaries and receive nothing until the 1.1.0 binary
  rollout (which will need its paired production-channel OTA per the release
  doc).

## Validation (all passed, on-device staging)

1. Google hero + attribution renders; chip-tap loads thumbnails ✅
2. Community-photo place shows community photos only ✅
3. Offline: plain layout, no error ✅
4. **Persistence proof:** kill/reopen visibly refetches (nothing cached) ✅
5. **Quota test:** cap temporarily set to 2/day; third place degraded
   gracefully to the plain layout ✅
6. **Event confirmation:** `place_viewed.photo_source` live in PostHog EU
   191007 with all three values (`google` ×7, `none` ×3, `community` ×1
   during the validation window). `'google'` is only reported when the hero
   image actually resolved — so **a capped/failing day is visible in PostHog
   as `none` on zero-photo places**: that's the monitoring signal for when
   the cap starts biting real users.

## Post-ship incident + hardening (same day)

Staging testing burned the full 30/day media budget (device pass + quota
test + validation curls ≈ 30), which surfaced a real robustness bug: a failed
media fetch was cached as a successful "no photo" for the whole session, so a
one-second blip looked like a permanent failure. Fixed: failures now land as
retryable error state (next visit refetches), thumbnail taps show placeholder
tiles immediately, and HTTP-level failures are captured to Sentry
(`feature: google_photos`). **Operational note for demo days:** the 30/day
cap is project-wide; heavy internal testing will quiet the photo layer until
the midnight-Pacific quota reset. Expected degradation, not an outage.

## Bonus fix (found during validation)

Offline validation surfaced a pre-existing M2 bug: removing a place from a
trip didn't clear the place-detail "Saved to trip" indicator when offline
(and the stale state persisted across relaunches). Root cause: the remove
mutation, unlike save, never optimistically updated the persisted
`savedPlaceIds` cache. Fixed symmetrically, multi-list-safe, shipped in the
same batch.

## Cost & sequencing summary

- Spend today: **$0**, physically guaranteed by the daily cap.
- At Option-A limits: photos stop rendering past ~1,000 media requests/month;
  current traffic is ~2% of that.
- M2 critical path unaffected; Aug 2 gates unaffected. Community photo
  pipeline remains the durable fix on the backlog (first post-Trip-Planning
  engagement candidate).

Commits: `c331e50` (feature), `2a17990` (trips fix). Preview OTAs concluded
with update group `fd638c27`.
