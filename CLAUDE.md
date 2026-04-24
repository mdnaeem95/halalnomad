# HalalNomad — project guidance for Claude

HalalNomad is a mobile app (iOS first, Expo/React Native) for Muslim
travellers to find Halal restaurants in non-Muslim-majority countries,
primarily East and Southeast Asia. Core loop: crowdsourced submissions,
community verification, tiered contributor gamification, Premium
subscription for offline maps + trip planning.

## Before starting any non-trivial work

Read the private strategy docs in `planning/` (gitignored, local only):

- `planning/business-roadmap.md` — product phases, target personas,
  monetisation strategy, go-to-market, metrics, Ramadan 2027 as the
  Phase 2 deadline, and what we're explicitly NOT building
- `planning/data-sourcing-strategy.md` — seed-data sourcing plan for
  priority tier-1 Asian cities, legal/ethical guardrails, staging
  pipeline

If those files don't exist on this machine, flag it and ask — they're
the strategic backbone.

## Non-negotiable design constraints

These come out of the strategy and should guide code decisions without
asking every time:

1. **Verification-first trust.** Seeded data defaults to `halal_level: 1
   (Reported)`. Only `halal_level: 4 (Trusted)` comes from a real
   certification body. Community verifications cap at level 3. Never
   auto-promote based on review count without a secondary signal.
2. **No banner ads.** Ever. Non-halal ads destroy the trust premise. If
   monetisation comes up, Premium + featured listings + affiliate are
   the levers.
3. **Multilingual, not translated.** Place names show in English +
   local script together. That matters in Japan/Korea/China/Thailand
   where locals can't read romanised names. Don't simplify this away.
4. **Offline-first for travellers.** Anything the user needs at a
   restaurant (details, directions, photos) must work without network.
5. **Utility before social.** No timelines, no DMs, no follow graph.
   Community shows up as verifications, tier badges, reviews. Resist
   scope creep into social features.
6. **Don't claim what we can't prove.** Never state a place is halal —
   only surface user-reported state with the appropriate trust level.

## Prioritised geography

Year-1 focus: **non-Muslim-majority Asia**. Tokyo, Osaka, Kyoto, Seoul,
Bangkok, Singapore, Taipei first. Don't waste cycles on Kuala Lumpur,
Jakarta, Dubai, Istanbul, etc. — saturated and our moat doesn't matter.
See `planning/data-sourcing-strategy.md` for tier detail.

## Ramadan is a forcing function

Every Ramadan is a user-acquisition event. Ramadan 2027 is 2027-02-17 →
2027-03-19. Phase 2 retention features (offline maps, trip planning,
prayer times) must be real by then. Don't let feature work slip past
end of Q4 2026.

## Code-level context

- Stack: Expo SDK 54 + React Native + TypeScript, Supabase backend,
  RevenueCat IAP, Sentry, PostHog. Expo Router for navigation.
- Dark mode uses `createStyles(c: AppColors)` factory pattern — see
  `profile.tsx` as the canonical example. Don't import static `colors`
  from the theme module; always use `useTheme()`.
- Migrations live in `app/src/lib/migration-*.sql`. Run them manually
  in Supabase SQL Editor. Number them sequentially.
- Release process: `./app/scripts/release-prod.sh "msg"` — runs
  `eas build` then publishes an OTA. Never ship a production build
  without a matching OTA. See `docs/release.md`.
- Push notifications: transactional, triggered from DB. Architecture in
  `docs/notifications.md`. Don't propose mass retention blasts without
  user feedback data to back the copy.

## When reviewing proposed features

Ask:
1. Does this reduce time-to-first-bite for a Muslim traveller in Tokyo?
2. Does it fit the current phase, or is it pulled in from a later phase?
3. Does it stay within the "utility-first, not a social app" boundary?
4. Is there a simpler alternative that gets 80% of the value?

Default to saying no to scope creep. The business roadmap is deliberately
narrow.

## When we add to `planning/`

New private strategy docs or notes should go in `planning/`. The entire
folder is gitignored. Don't commit strategy content.
