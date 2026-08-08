# HalalNomad — Monday digest / review #3 (2026-08-04)

First review with real users possible (1.1.0 public since Jul 30). Sources:
PostHog Weekly Performance dashboard (all 21 tiles refreshed), targeted
HogQL pulls, Supabase ground truth, GSC API (automated). Windows noted
per section; the "current" dashboard week is only 2 days old (Aug 2–3),
so week-of-Jul-26 is the primary read.

## Headline

**The machine is built, instrumented end-to-end, and idling: acquisition
is effectively zero, so every downstream funnel reads "no fuel" rather
than "broken."** Since the public release: ~3 install events (one likely
Apple review), zero signups, zero place views from anyone but us, zero
contributions. Nothing in the data suggests a product problem — nothing
has been pointed at the product yet.

## A · Release / adoption state

- 1.1.0 (build 13) public since Jul 30; production OTA channel current.
- Install events: Jul 29 ×1 (plausibly Apple review), Aug 1 ×1, Aug 2 ×1 —
  three distinct devices. 5 distinct devices active in total since Jul 30
  (incl. our two).
- **Version adoption: 1.0.0 = 0 events for the 3rd straight week.** The
  pre-existing App Store install base hasn't returned; the effective real
  install base is the post-release trickle.
- Zero new `profiles` rows since Jul 30 — no one has signed up.

## B · C1 activation funnel — the first read

`Application Installed 7 → onboarding_completed 0 → place_viewed 0 →
place_saved_to_list 0` (funnel window incl. pre-release test installs).

Corroborating hard fact: **there are zero `place_viewed` events from any
device since Jul 30.** The new installs either never opened the app
meaningfully or stalled before the first place view. At n≈2–3 (minus a
probable Apple reviewer) this is directional only — but the honest
statement is: **activation is untested, not passing.** The onboarding
funnel itself (A3, larger window) converts 8→6 viewed→completed with the
drop at the disclaimer step; watchable, not conclusive.

## C · Contribution loop

Zero across both telemetry and DB ground truth: 0 adds, 0 verifications,
0 reviews, 0 photos (events AND `verifications`/`reviews` tables since
Jul 30). The 26 new `places` rows this week are the Seoul seed batch, not
users. The flywheel still hasn't turned once — expected pre-acquisition,
but it stays the #1 thing to watch once traffic starts, because the
Tokyo/Seoul pages' all-"Reported" walls only improve via this loop (plus
the pending cert-review lever).

## D · Photos quota (Google layer)

**Unexercised: zero Google-layer fetches since Jul 30** (no place views →
no media requests). Spend $0; the 30/day cap has never bitten a real
user. The `photo_source` property is live and will make cap pressure
visible as `none`-on-zero-photo-places the moment real browsing starts.
Nothing to tune yet.

## E · GSC — week 2 (window Jul 17–31; API-automated now)

- **First organic clicks ever: 2** (Jul 30 + 31, homepage; site appeared
  at position 4 on the 30th).
- Homepage: 34 imp (+13 WoW), position 8.6 (from 9.9). Driven by the
  "nomad halal" collision cluster (8 imp @ 5.6).
- /tokyo: 28 imp (+6), position ~43 (flat), and **new long-tail variants
  keep appearing** ("halal food in ueno tokyo" joined) — intent-match is
  excellent, depth needs authority.
- Daily impressions trend up through the window (closing day = highest).
  Per the Sprint-03 spec's own success signal (impressions compounding),
  **the next city pages are justified**: Seoul + Bangkok specs are
  build-ready, gated only on Sani's hero sanity pass ×2 (+ the optional
  cert review that would give /seoul the first green "Trusted" badges).

## F · Reading + asks

1. **The gate question this digest actually raises:** distribution.
   Store-listing-only yields ~1 install/day. Everything downstream of
   acquisition is unmeasurable until something feeds it (ASO pass,
   first content push per the playbooks, or the summer-2027 runway
   plan starting earlier — PM's lane, but the data says it's the only
   blocked artery).
2. Sani unlocks two cheap levers this week: hero sanity pass ×2 → the
   Seoul/Bangkok pages ship (~1–2h dev, triples indexable surface);
   cert review → first Trusted badges.
3. Watch item for next digest: whether the Aug 1/2 installers return
   (B3 week-7 cohort) — first genuine retention datapoint if so.
4. Instrumentation debt: none new. All M2 events verified live;
   permission tile now counts decisions; PostHog-RN offline-buffer loss
   remains parked (analytics-only).
