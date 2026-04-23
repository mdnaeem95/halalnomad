# HalalNomad

A mobile app that helps Muslim travellers discover verified Halal food and places worldwide, powered by community contributions.

## Features

- Map and list discovery with 51+ seed places across 13 cities
- Custom map markers (color-coded by trust level, featured star)
- Map carousel — swipe through place cards, map auto-zooms to each
- Distance sorting with formatted labels (nearest first)
- Community verification system with confidence scoring
- Contributor points and tier system (Explorer → Guide → Ambassador → Legend)
- Dual-language display (English + local script — Chinese, Arabic, Korean, Thai, etc.)
- Adaptive map providers (Google Maps globally, AMap for China)
- Report system with probability indicators
- Map pin picker for adding places at the correct location
- Offline support with persistent 24hr cache
- Dark mode (system detection + manual toggle)
- 4 languages: English, Arabic, Turkish, Bahasa Melayu
- Push notifications infrastructure (Expo Push + Supabase)
- Premium subscription (RevenueCat) — offline maps, advanced filters, trip planning
- Featured restaurant listings with tiered visibility boost
- Animated splash screen while loading
- Skeleton loaders, haptic feedback, pull-to-refresh
- WCAG AA accessible, RTL support for Arabic
- Sentry crash reporting, PostHog analytics
- App store rating prompt after positive interactions

## Tech Stack

- **React Native** (Expo SDK 54) with **TypeScript**
- **TanStack Query** — server state, caching, optimistic updates
- **Zustand** — client state
- **React Hook Form + Zod** — form validation
- **Supabase** — PostgreSQL + PostGIS, Auth, Storage
- **expo-image** — image caching with blurhash
- **@shopify/flash-list** — high-performance lists
- **Sentry** — crash reporting
- **PostHog** — privacy-friendly analytics
- **RevenueCat** — in-app subscriptions
- **i18next** — internationalization (EN, AR, TR, MS)

## Getting Started

### Prerequisites

- Node.js 22+
- Expo CLI (`npx expo`)
- iOS Simulator or Android Emulator (or Expo Go)

### Setup

```bash
cd app
npm install
cp .env.example .env
# Fill in your Supabase URL and anon key in .env
```

### Database

1. Create a [Supabase](https://supabase.com) project
2. Run `src/lib/schema.sql` in the SQL Editor
3. Run `src/lib/migration-001-fix-profiles-rls.sql`
4. Run `src/lib/migration-002-fix-trigger.sql`
5. Run `src/lib/migration-003-report-counts.sql`
6. Run `src/lib/migration-004-featured-listings.sql`
7. Optionally run `src/lib/seed-data.sql` for sample places

### Run

```bash
npx expo start
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start Expo dev server |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run lint` | ESLint check |
| `npm run typecheck` | TypeScript type check |
| `npm run ci` | Full CI check (typecheck + lint + test) |

## Project Structure

```
halal/
├── docs/                          # Product docs
│   ├── product-spec.md
│   ├── competitive-analysis.md
│   ├── technical-architecture.md
│   ├── mvp-scope.md
│   ├── business-model.md
│   └── production-readiness.md
├── .github/workflows/ci.yml       # GitHub Actions CI
└── app/                           # React Native app
    ├── app/                       # Expo Router screens
    │   ├── _layout.tsx            # Root layout (providers)
    │   ├── auth.tsx               # Auth modal
    │   ├── place/[id].tsx         # Place detail
    │   └── (tabs)/               # Tab navigation
    └── src/
        ├── __tests__/             # Jest test suites
        ├── components/            # UI components
        ├── constants/theme.ts     # Design system
        ├── hooks/                 # Custom hooks
        ├── i18n/                  # Translations (en, ar, tr, ms)
        ├── lib/                   # Supabase, schemas, sentry, etc.
        ├── services/              # API + map abstraction
        ├── stores/                # Zustand stores
        └── types/                 # TypeScript types
```

## License

Private — not open source.
