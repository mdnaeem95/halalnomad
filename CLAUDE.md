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
7. **Not an Islamic lifestyle app.** No prayer times, no Quran, no
   mosque finder, no iftar timer, no Ramadan mode. Those spaces are
   saturated (Muslim Pro, etc.) and out of scope. HalalNomad is
   exactly one thing: a halal food discovery utility for travellers.
   Religion-adjacent features may be added later if and only if real
   user demand surfaces — never presumed.

## Prioritised geography

Year-1 focus: **non-Muslim-majority Asia**. Tokyo, Osaka, Kyoto, Seoul,
Bangkok, Singapore, Taipei first. Don't waste cycles on Kuala Lumpur,
Jakarta, Dubai, Istanbul, etc. — saturated and our moat doesn't matter.
See `planning/data-sourcing-strategy.md` for tier detail.

**Ramadan is a forcing function.** Next marquee event: Ramadan 2027
(2027-02-17 → 2027-03-19). Phase 2 retention features (offline maps,
trip planning, prayer times) must be real by then.

## Project structure

```
halal/
├── app/                             # Expo RN mobile app
│   ├── app/                         # Expo Router screens (file-based routes)
│   │   ├── _layout.tsx              # Root: providers, splash, auth gate
│   │   ├── (tabs)/                  # Tab navigator
│   │   │   ├── index.tsx            #   Explore (home map/list)
│   │   │   ├── search.tsx
│   │   │   ├── add.tsx              #   Add place form
│   │   │   └── profile.tsx          #   Profile + settings
│   │   ├── place/[id].tsx           # Place detail screen
│   │   ├── auth.tsx                 # Sign in / sign up (modal)
│   │   └── paywall.tsx              # Premium paywall (modal)
│   ├── src/
│   │   ├── components/              # Shared UI components
│   │   ├── hooks/                   # React hooks (useAuth, usePlaces, etc.)
│   │   ├── lib/                     # Libs: supabase, rc, sentry, analytics,
│   │   │                            # notifications, i18n setup, migrations
│   │   ├── services/                # Business logic (places, map providers)
│   │   ├── stores/                  # Zustand stores (app-store)
│   │   ├── constants/theme.ts       # Colors, typography, spacing, shadows
│   │   ├── i18n/locales/            # en, ms, ar, tr
│   │   └── types/                   # TypeScript types
│   ├── scripts/release-prod.sh      # Production build + matching OTA
│   ├── app.json                     # Expo config (bundle IDs, splash, plugins)
│   ├── eas.json                     # Build profiles (dev / preview / prod)
│   └── .env                         # EXPO_PUBLIC_ secrets (gitignored)
├── supabase/
│   └── functions/send-push/         # Edge function for push drain
├── docs/                            # Committed reference docs
└── planning/                        # Private strategy docs (gitignored)
```

## Stack

Details live in [docs/technical-architecture.md](docs/technical-architecture.md).
Operational summary:

- **Client:** Expo SDK 54, React Native, TypeScript strict, Expo Router
- **Server state:** TanStack Query v5 (persisted to AsyncStorage, 24h TTL)
- **Client state:** Zustand (`app-store.ts` — language, colorScheme, filters)
- **Forms:** react-hook-form + zod (schemas in `src/lib/schemas.ts`)
- **Backend:** Supabase (Postgres + PostGIS + Auth + Storage)
- **Maps:** react-native-maps with a provider abstraction (Google default,
  AMap/Baidu/Yandex stubs in `services/map/`)
- **IAP:** RevenueCat (`src/lib/revenue-cat.ts`) — init at app launch,
  login/logout wired into auth state changes
- **Push:** expo-notifications — token registered on sign-in, AppState
  heartbeat for `last_active_at`, deep-link handler routes `placeId` →
  `/place/:id` and `screen` → any expo-router path
- **Errors:** Sentry (`src/lib/sentry.ts`, `initSentry()` at module load)
- **Analytics:** PostHog (`src/lib/analytics.ts`, `EVENTS` enum is the
  single source of event names)
- **i18n:** i18next + react-i18next. English primary, others fall back
  to en when keys are missing
- **OTA:** expo-updates pointing at the `production` channel. **Every
  production build needs a matching `eas update` or the binary ships
  with stale JS served over the top.** See [docs/release.md](docs/release.md).

## Data model essentials

Tables live in Supabase. Canonical schema is `src/lib/schema.sql` + the
numbered migrations in `src/lib/migration-*.sql`. Key tables:

- **`profiles`** (extends Supabase `auth.users`) — `id`, `email`,
  `display_name`, `avatar_url`, `points`, `push_token`,
  `notifications_enabled`, `timezone`, `last_active_at`, `created_at`.
  Tier is derived in the client from `points` via `TIER_THRESHOLDS`
  (see `src/types/index.ts`).
- **`places`** — `id`, `name_en`, `name_local`, `address_en`,
  `address_local`, `latitude`, `longitude`, `coord_system`,
  `cuisine_type`, `price_range`, `halal_level (1–4)`, `description`,
  `hours`, `photos[]`, `added_by`, `last_verified_at`,
  `verification_count`, `closed_reports`, `not_halal_reports`,
  `is_featured`, `featured_tier`, `is_active`, `created_at`.
- **`verifications`** — user-submitted actions on a place.
  `type IN ('confirm', 'certificate', 'flag_closed', 'flag_not_halal')`
  with a `UNIQUE(place_id, user_id, type)` constraint so a user can
  only perform each action once per place. `useUserVerifications(placeId,
  userId)` hook reads this to disable already-used buttons.
- **`reviews`** — star rating + text, one per `(place, user)`.
- **`notifications_queue` / `notifications_log`** — RLS-locked to
  service role only. Triggers enqueue, the `send-push` edge function
  drains (see [docs/notifications.md](docs/notifications.md)).

Points are awarded server-side via `award_points(user_id, amount)`
RPC (see `services/places.ts`). Verification counts increment via
`increment_verification` and `increment_report_count` RPCs. Auto-upgrade
to `halal_level: 2` happens at `verification_count >= 3`.

## Patterns to follow

### Theme / dark mode

**Always** use the factory pattern. Static `colors` import from
`constants/theme.ts` is the light palette only — freezes dark mode
into unreadable text.

```tsx
import { useTheme } from '../hooks/useTheme';
import { AppColors } from '../constants/theme';

function Screen() {
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);
  // use c.textPrimary, c.surface, etc. in inline overrides too
}

const createStyles = (c: AppColors) => StyleSheet.create({
  title: { color: c.textPrimary },
  card: { backgroundColor: c.surface },
});
```

Canonical example: `app/app/(tabs)/profile.tsx`.

### React Query keys

Centralised in each domain hook file. Example from `src/hooks/usePlaces.ts`:

```ts
export const placeKeys = {
  all: ['places'] as const,
  nearby: (lat, lng) => ['places', 'nearby', lat, lng] as const,
  detail: (id) => ['places', 'detail', id] as const,
  search: (q, cuisine) => ['places', 'search', q, cuisine] as const,
  reviews: (placeId) => ['places', 'reviews', placeId] as const,
  userVerifications: (placeId, userId) =>
    ['places', 'user-verifications', placeId, userId] as const,
};
```

Mutations invalidate using these in `onSettled`. Always add new keys
here rather than inline.

### Auth + profile refresh

`useAuth()` exposes `{ session, user, profile, signIn, signOut,
refreshProfile, ... }`. After any mutation that changes
`profiles.points` (add place, verify, report, etc.), call
`refreshProfile()` in `onSuccess` so the Profile tab's points stay in
sync. Cached profile is NOT auto-invalidated.

### Cooldowns + dedupe

Fast-tap protection: `useCooldown(ms)` returns `{ isOnCooldown, trigger
}`. Use it on destructive/write buttons. Server-side dedupe is enforced
by the `UNIQUE` constraint on `verifications` and by the
`useUserVerifications` hook which disables already-used buttons
client-side (see `place/[id].tsx`).

### Migrations

Numbered sequentially in `app/src/lib/migration-*.sql`. Current set:

- `001` — profiles RLS fix
- `002` — trigger fix
- `003` — report counts (`closed_reports`, `not_halal_reports`)
- `004` — featured listings (`is_featured`, `featured_tier`)
- `005` — `push_token` on profiles
- `006` — notifications infra (queue, log, triggers, profile fields)
- `007` — `places_staging` table + `places.sources` JSONB +
  `promote_staged_place()` RPC for the seed-data pipeline
- `008` — `place_type` column on `places` (and `places_staging`) so
  groceries / butchers / bakeries / cafes / sweet shops surface
  differently in the UI than restaurants

**Run them manually in Supabase SQL Editor.** No migration runner yet.
When adding a new one, keep the number sequence and document the
change at the top of the file.

### Analytics events

Always via the `EVENTS` enum in `src/lib/analytics.ts`. Don't pass raw
strings to `track()`. New events go in the enum first.

### Environment variables

- `app/.env` is gitignored but uploaded to EAS Build. Holds
  `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`,
  `EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_POSTHOG_API_KEY`,
  `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
- Critical `EXPO_PUBLIC_*` vars are also duplicated as EAS environment
  variables (for production builds): `npx eas-cli env:list production`
  to audit.
- Don't trust either source alone — treat `.env` as dev-authoritative,
  EAS env as prod-authoritative. Keep them in sync.

### Release

`./app/scripts/release-prod.sh "short message"` — builds iOS
production binary and publishes a matching OTA to the `production`
channel. Never do `eas build` on production without the matching
`eas update` or the binary will ship with stale JS overridden by an
older OTA. Full detail in [docs/release.md](docs/release.md).

JS-only fixes: `npx eas-cli update --branch production --platform ios
--message "..."` — skips App Review, usually live within a couple of
cold starts.

### Seeding place data

Pipeline lives in `scripts/seed/` (Python). Per-city runbook in
[scripts/seed/README.md](scripts/seed/README.md) — follow it step by
step for each new city, capturing the breakdown via
`python report.py breakdown <city>` at each stage. Cities prioritised
in `planning/data-sourcing-strategy.md`.

Default trust on seeded rows is `halal_level: 1` (Reported).
Community verifications upgrade from there. Cert-body sources can land
at level 4, but Google Places never does.

## Known pitfalls (things we've already been burned by)

- **OTA override trap.** A new `eas build` ships with correct bundled
  JS, but at first launch `expo-updates` downloads the previous
  `production` channel OTA and runs THAT. Every new build looks
  identical until you also push a new OTA. Always pair them.
- **`console.warn` in production RN builds** does not surface in
  Console.app. For production debugging, either capture to Sentry or
  render a temporary diagnostic to the UI (we've done this for RC).
- **Static `colors` import freezes light-mode.** See theme pattern
  above. Don't reference `colors.X` inside `StyleSheet.create` — use
  the factory.
- **Dev-client IAP is more lenient than TestFlight.** Products in ASC
  `DEVELOPER_ACTION_NEEDED` can appear to work in the dev build
  (sandbox tolerant) but fail in TestFlight (production-signed).
  Always test IAP on a real TestFlight build before declaring it fixed.
- **Apple "third-party platform" language.** Any string in the binary
  that mentions "Google Play", "Android", or the like triggers 2.3.10
  rejection. Keep subscription disclosures platform-aware via
  `Platform.OS` + i18n interpolation.
- **RC entitlement ID is case-sensitive and includes spaces.** Code
  checks for `'HalalNomad Premium'` exactly. If the dashboard gets
  renamed, post-purchase premium checks silently fail.
- **First-launch verifications race.** `useUserVerifications` returns
  `hasConfirmed: false` during initial load — cooldowns + the DB
  `UNIQUE` constraint backstop the window.

## When reviewing proposed features

Ask:
1. Does this reduce time-to-first-bite for a Muslim traveller in Tokyo?
2. Does it fit the current phase, or is it pulled in from a later phase?
3. Does it stay within the "utility-first, not a social app" boundary?
4. Is there a simpler alternative that gets 80% of the value?

Default to saying no to scope creep. The business roadmap is deliberately
narrow.

## Doc map

- [docs/technical-architecture.md](docs/technical-architecture.md) —
  stack-level overview, tech choices, data model diagram
- [docs/release.md](docs/release.md) — build + OTA workflow, pitfalls,
  rollback
- [docs/notifications.md](docs/notifications.md) — queue/log/trigger
  architecture, how to add new notification types
- [docs/production-readiness.md](docs/production-readiness.md) —
  launch checklist (partially stale; update as things land)
- [docs/app-store-checklist.md](docs/app-store-checklist.md) — App
  Store submission details
- [docs/product-spec.md](docs/product-spec.md) — original product spec
- [docs/mvp-scope.md](docs/mvp-scope.md) — what counts as in-scope for
  MVP
- [docs/business-model.md](docs/business-model.md),
  [docs/competitive-analysis.md](docs/competitive-analysis.md) —
  older strategy docs; current thinking lives in `planning/`

## Adding to `planning/`

New private strategy docs or notes go in `planning/`. The folder is
gitignored. Don't commit strategy content.
