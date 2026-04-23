# Release Scope & Roadmap

## v1.0 — Production Release (Current)

Everything below is **built and functional**.

### Core Features
- Map and list discovery with Google Maps (adaptive provider architecture for China/others)
- Custom branded map markers — color-coded by halal verification level, gold star for featured
- Map carousel — tap "N places found" pill to browse cards horizontally, auto-zooms to each place
- Distance sorting — places sorted nearest-first with distance labels (Haversine formula)
- 51 seed places across 13 cities worldwide
- Place details with dual-language display (English + local script)
- Community verification system with 4-tier trust model
- Report system with logarithmic confidence scoring
- Search with 300ms debounce and cuisine type filtering
- Pull-to-refresh on all lists
- Map pin picker for adding places — drop & drag pin at restaurant's actual location

### Contributor System
- Points awarded for: add place (50), certificate (30), review (20), verify (15), photo (10), report (10)
- 4 contributor tiers: Explorer → Guide → Ambassador → Legend
- Points and tier visible on profile screen

### Authentication
- Email + password with email verification flow
- Auth tokens stored in OS Keychain / EncryptedSharedPreferences
- Biometric auth hook ready (Face ID, Touch ID, fingerprint)

### Monetization
- **Premium subscription** via RevenueCat ($4.99/mo or $29.99/yr)
  - Offline city maps, advanced filters, trip planning, ad-free, priority support
  - Paywall screen with feature breakdown and pricing
  - Restore purchases support
- **Featured listings** for restaurants
  - 3 tiers: Highlighted ($10/mo), Promoted ($25/mo), Spotlight ($50/mo)
  - Featured badge on cards and detail screen
  - Sort boost in nearby and search results

### Architecture
- TanStack Query v5 (server state, caching, optimistic updates, retry)
- Zustand (client state, preferences, filters)
- React Hook Form + Zod (form validation)
- expo-image (caching, blurhash placeholders)
- FlashList (high-performance lists)
- Skeleton loaders (shimmer loading states)
- Haptic feedback on key interactions

### Reliability
- Sentry crash reporting + performance monitoring
- Offline-first: 24hr cache persisted to AsyncStorage
- Network awareness with animated offline banner
- All mutations retry 2x with exponential backoff
- Error boundaries with retry UI

### Security
- Secure token storage (Keychain / EncryptedSharedPreferences)
- Input sanitization (HTML stripping, XSS prevention)
- Client-side rate limiting (5s cooldown on verify/report)
- Zod schema validation on all user input

### Accessibility
- Screen reader labels on all interactive elements
- WCAG AA color contrast (4.5:1 minimum)
- RTL-safe styles throughout
- Live regions for toasts and offline banner
- Modal focus trapping

### Internationalization
- 4 languages: English, Arabic, Turkish, Bahasa Melayu
- RTL support for Arabic
- Device locale auto-detection
- Language selector on profile screen

### Analytics & Growth
- PostHog event tracking (15 events across all flows)
- App store rating prompt after 3 positive actions
- Identity chain: Auth → Sentry + PostHog (anonymous ID only)

### Quality
- 60 unit tests across 5 suites (all passing)
- ESLint with typescript-eslint + react-hooks (0 errors)
- GitHub Actions CI (typecheck → lint → test)
- EAS Build profiles (development, preview, production)

### Seed Data Cities
Beijing, Xi'an, Tokyo, Seoul, London, Paris, Istanbul, Bangkok, Singapore, Dubai, Kuala Lumpur, New York, Barcelona

---

## v1.1 — Post-Launch Iteration

- Dark mode (system preference + manual toggle)
- Additional regional map providers (AMap for China, Yandex for Russia)
- Push notifications ("Your report was confirmed", "New places in your city")
- Offline city download (explicit "Download City" feature)
- Additional languages (Urdu, Bahasa Indonesia, French)
- Improved search (fuzzy matching, nearby suggestions)
- Photo moderation pipeline

## v2.0 — Scale

- Restaurant owner self-service portal
- Tourism board partnerships
- In-app advertising (tasteful, relevant, limited)
- Affiliate/booking commissions
- City guides ("Top 10 Halal in Tokyo")
- API for third-party integrations
- Web app
