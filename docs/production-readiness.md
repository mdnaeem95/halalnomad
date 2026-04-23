# Production Readiness Plan

## Current State

Working app with:
- Map/list discovery with 51 seed places across 13 cities
- Auth (email + verification flow)
- Add/verify/report places with community confidence system
- Contributor points and tier system
- Custom dialogs and toasts (no native alerts)
- Dual-language name display (romanized + local script)

**Architecture (completed):**
- TanStack Query v5 for server state (caching, dedup, optimistic updates, retry)
- Zustand for client state (view prefs, search filters)
- React Hook Form + Zod for form validation
- Error boundaries with retry UI (Sentry capture)
- expo-image with blurhash placeholders and caching
- FlashList for high-performance list rendering
- Skeleton loaders replacing ActivityIndicator spinners
- Haptic feedback on key interactions
- Pull-to-refresh on all lists
- 300ms debounced search
- Sentry crash reporting and performance monitoring
- Offline-first: TanStack Query cache persisted to AsyncStorage (24hr)
- Network awareness: auto-detect offline, show banner, pause queries, resume on reconnect
- Retry logic: all mutations retry 2x with exponential backoff via p-retry

**Security (completed):**
- Auth tokens in OS Keychain / EncryptedSharedPreferences (expo-secure-store)
- Biometric auth hook ready (Face ID, Touch ID, fingerprint)
- Input sanitization on all user text (HTML stripping, whitespace normalization)
- Client-side rate limiting (5s cooldown on verify/report to prevent double-taps)

**Accessibility (completed):**
- Screen reader labels on all interactive elements (buttons, cards, badges, dialogs)
- Modal `accessibilityViewIsModal` for proper VoiceOver focus trapping
- Toast and offline banner as `accessibilityLiveRegion` for announcements
- WCAG AA contrast audit — `textTertiary` bumped from #999 to #757575 (4.6:1), `textSecondary` from #666 to #555 (7.5:1)
- RTL-safe styles: `paddingStart`/`paddingEnd`/`marginStart`/`marginEnd` replacing `left`/`right`
- `accessibilityState` for disabled verify/report buttons
- `accessibilityHint` on contributor actions ("Awards you 15 points")

**Internationalization (completed):**
- i18next + react-i18next with expo-localization for device locale detection
- 4 languages: English, Arabic (العربية), Turkish (Türkçe), Bahasa Melayu
- All UI strings extracted into translation files (~150 keys per language)
- Pluralization support (i18next v4 `_one`/`_other` suffixes)
- RTL support for Arabic (`I18nManager.forceRTL`, `start`/`end` styles)
- Language selector on Profile screen (available even when logged out)
- Language preference stored in Zustand

**Testing (completed):**
- Jest + jest-expo configured with `npm test`
- 60 tests across 5 test suites, all passing
- Unit tests: sanitization (HTML stripping, unicode, multiline), coordinate conversion (WGS-84/GCJ-02/BD-09 roundtrips), tier calculation, report confidence algorithm
- Schema tests: all 4 Zod schemas (signIn, signUp, addPlace, review) with valid/invalid/edge cases
- Coverage collection configured (`npm run test:coverage`)
- Tests also caught and fixed a real bug in `sanitizeMultiline` (trailing line spaces)

**CI/CD (completed):**
- ESLint (flat config, typescript-eslint, react-hooks) — 0 errors
- `npm run ci` runs typecheck → lint → test in sequence
- GitHub Actions workflow: runs on every push/PR to main
- EAS Build profiles: development, preview, production
- EAS Submit config for App Store and Play Store (template — fill in credentials)
- README with setup guide, scripts, project structure

**Analytics & Growth (completed):**
- PostHog analytics — privacy-friendly, open-source, no PII
- 15 tracked events across discovery, contributions, auth, engagement
- App store rating prompt after 3 positive actions (follows Apple/Google guidelines)
- User identity linked to Sentry + PostHog (anonymous ID only)

**Monetization (completed):**
- RevenueCat integration for premium subscriptions (monthly $4.99, yearly $29.99)
- Paywall screen with feature list, pricing, purchase, and restore
- Featured listings with 3 tiers (highlighted, promoted, spotlight), badge, and sort boost
- Premium upsell card on profile screen
- `usePremium()` hook for gating features

**Dark mode (completed):**
- Full light and dark color palettes with WCAG AA contrast
- `useTheme()` hook reads system preference or manual override
- System / Light / Dark segmented toggle on Profile screen
- Dynamic colors applied to all screens, cards, inputs, buttons, nav

**Post-launch work:** restaurant owner portal, more seed data cities, AMap for China, photo moderation pipeline.

---

## All Phases Complete

- ~~Phase 1: Foundation (Architecture & DX)~~ COMPLETED
- ~~Phase 2: UI/UX Polish~~ COMPLETED
- ~~Phase 3: Reliability & Offline~~ COMPLETED
- ~~Phase 4: Security~~ COMPLETED
- ~~Phase 5: Accessibility~~ COMPLETED
- ~~Phase 6: Internationalization~~ COMPLETED
- ~~Phase 7: Testing~~ COMPLETED
- ~~Phase 8: CI/CD & Release~~ COMPLETED
- ~~Phase 9: Analytics & Growth~~ COMPLETED
- ~~Monetization: Subscriptions + Featured Listings~~ COMPLETED

## Ready to Ship

To launch:
1. Create RevenueCat project and configure products in App Store Connect / Google Play Console
2. Add API keys to `.env`: `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
3. Create Sentry project and add `EXPO_PUBLIC_SENTRY_DSN`
4. Create PostHog project and add `EXPO_PUBLIC_POSTHOG_API_KEY`
5. Fill in EAS credentials in `eas.json` (Apple ID, ASC App ID, Google service account)
6. Run migration-004 in Supabase SQL Editor
7. `eas build --profile production --platform all`
8. `eas submit --profile production --platform all`

Everything else builds on this. Must be done first.

### 1.1 State Management — TanStack Query + Zustand

Replace raw `useState` + `useEffect` fetching with proper server state management.

| Concern | Solution |
|---------|----------|
| Server state (places, reviews, profiles) | TanStack Query v5 — caching, deduplication, background refetch, optimistic updates, retry with exponential backoff |
| Client state (UI preferences, map provider, filters) | Zustand — lightweight, no boilerplate |
| Auth state | Keep existing Context (already works) |

**Why this matters:** Eliminates the stale-data bugs we've been fixing manually (e.g., list not updating after reports). TanStack Query handles cache invalidation, refetch-on-focus, and optimistic updates out of the box — we're currently reimplementing these patterns by hand.

```
npm install @tanstack/react-query zustand
```

### 1.2 Form Validation — React Hook Form + Zod

Replace manual string checks with schema-based validation.

```
npm install react-hook-form zod @hookform/resolvers
```

- Zod schemas for: Add Place, Sign Up, Sign In, Review
- Type-safe form state, field-level errors, submit handling
- Reusable across app and server-side validation

### 1.3 Error Boundaries

Wrap every screen in an error boundary with a fallback UI ("Something went wrong — tap to retry"). Prevents full app crashes from propagating.

```tsx
// Wrap in app/_layout.tsx around each Stack.Screen
<ErrorBoundary fallback={<ErrorFallback />}>
  <Stack.Screen ... />
</ErrorBoundary>
```

### 1.4 Environment & Config

- Create `.env.example` with placeholder values
- Use `expo-constants` for app config
- Separate env profiles: development, staging, production
- Configure `eas.json` with build profiles

---

## Phase 2: UI/UX Polish

Modern mobile UX patterns that users expect.

### 2.1 Image Performance — expo-image

Replace `<Image>` with `expo-image` everywhere. It provides:
- Disk + memory caching (backed by SDWebImage / Coil)
- Blurhash placeholders (show a blurred preview while loading)
- AVIF/WebP support for smaller payloads
- Transition animations on load

```
npx expo install expo-image
```

### 2.2 List Performance — FlashList

Replace `FlatList` with Shopify's `FlashList` on Explore list view and Search results. Significantly better scroll performance with large datasets.

```
npx expo install @shopify/flash-list
```

### 2.3 Skeleton Loaders

Replace `ActivityIndicator` spinners with skeleton screens that match the layout of the content being loaded. Use `moti` (built on Reanimated):

```
npm install moti
```

- Skeleton PlaceCard (shimmer effect matching card layout)
- Skeleton PlaceDetail (shimmer for header, details card, reviews)
- Skeleton Profile

### 2.4 Pull-to-Refresh

Add `RefreshControl` to:
- Explore list view
- Search results
- Profile screen (refresh points/tier)

### 2.5 Bottom Sheet for Place Actions

Replace the inline action buttons on place detail with a `@gorhom/bottom-sheet`:
- "Confirm Halal", "Report", "Get Directions", "Share" actions
- Slides up from bottom, feels native
- Better use of screen real estate

```
npm install @gorhom/bottom-sheet
```

### 2.6 Haptic Feedback

Add subtle haptics for key interactions:
- Tap on map pin → light impact
- Verify / Report → success notification
- Pull-to-refresh → light impact on trigger
- Tab switch → selection changed

```
npx expo install expo-haptics
```

### 2.7 Animated Transitions

Use `react-native-reanimated` (already installed) for:
- Card press animations (scale + opacity)
- View mode toggle (map ↔ list) crossfade
- HalalBadge level-up animation when verification count changes
- Toast slide-in/out (replace current basic Animated)

### 2.8 Dark Mode

- Extend `theme.ts` with a dark color palette
- Use `useColorScheme()` to detect system preference
- Wrap in a ThemeProvider context
- Store user override in Zustand (light / dark / system)
- All components read from theme context, not hardcoded `colors.*`

### 2.9 Search UX

- Debounce search input (300ms) to avoid hammering the API
- Show recent searches (persist in AsyncStorage)
- "Search as I type" with inline results
- Empty state with suggested cities or popular places

---

## Phase 3: Reliability & Offline

### 3.1 Offline Data — TanStack Query Persister

- Persist TanStack Query cache to AsyncStorage
- Places the user has viewed are available offline
- Queued mutations (add place, verify, report) sync when back online
- Show "offline" banner when no connectivity

### 3.2 Crash Reporting — Sentry

```
npx expo install @sentry/react-native
```

- Automatic crash reports with stack traces
- Performance monitoring (slow screens, API latency)
- User context (anonymous ID, not PII)
- Release tracking tied to EAS builds

### 3.3 Retry Logic

- TanStack Query handles retries for queries automatically
- For mutations (add place, verify), use `p-retry` with exponential backoff
- Show "Retrying..." state in UI, not silent failure

### 3.4 Network Awareness

```
npx expo install @react-native-community/netinfo
```

- Detect online/offline state
- Show persistent banner when offline
- Disable mutation buttons when offline (or queue for later)
- Auto-refetch when connectivity returns

---

## Phase 4: Security

### 4.1 Secure Token Storage

Move auth tokens from AsyncStorage to `expo-secure-store` (Keychain on iOS, EncryptedSharedPreferences on Android).

```
npx expo install expo-secure-store
```

Update the Supabase client's storage adapter.

### 4.2 Biometric Auth

Optional "unlock with Face ID / fingerprint" for returning users.

```
npx expo install expo-local-authentication
```

### 4.3 Input Sanitization

- Zod schemas validate all user input before API calls (Phase 1)
- Server-side: Supabase RLS already handles authorization
- Sanitize text input for XSS (strip HTML tags from reviews/descriptions)

### 4.4 Rate Limiting

- Debounce search (Phase 2)
- Client-side cooldown on verify/report buttons (prevent double-tap)
- Server-side: Supabase Edge Functions with rate limiting per user

---

## Phase 5: Accessibility

### 5.1 Screen Reader Support

Add to every interactive element:
```tsx
accessibilityLabel="Confirm this place is Halal"
accessibilityRole="button"
accessibilityHint="Awards you 15 points"
```

Priority screens: Explore, PlaceDetail, Auth, Add Place.

### 5.2 Dynamic Text Sizing

- Respect system font size (`allowFontScaling={true}` — default)
- Test layouts at 200% text size
- Use `maxFontSizeMultiplier` where layout would break

### 5.3 Color Contrast

- Audit all text/background combinations for WCAG AA (4.5:1 ratio)
- Ensure halal badges, warnings, and report bars are distinguishable without color alone (add icons/patterns)

### 5.4 RTL Support

Critical for Arabic-speaking users (a significant portion of our audience):
- Use `start`/`end` instead of `left`/`right` in all styles
- Test with `I18nManager.forceRTL(true)`
- Ensure map controls, cards, and navigation work in RTL

---

## Phase 6: Internationalization

### 6.1 i18n Setup

```
npm install i18next react-i18next expo-localization
```

- Extract all UI strings into translation files
- Start with English, Arabic, Bahasa, Turkish, Urdu
- Auto-detect device locale via `expo-localization`
- Language switcher in Settings

### 6.2 RTL Layout

- Configure `I18nManager` for Arabic, Urdu, Hebrew
- Audit all flex layouts for RTL compatibility
- Test every screen in RTL mode

---

## Phase 7: Testing

### 7.1 Unit Tests

```
npm install -D jest @testing-library/react-native @testing-library/jest-native
```

Priority targets:
- `reportConfidence()` function (pure logic)
- `getTierForPoints()` function
- Coordinate conversion utilities (GCJ-02 ↔ WGS-84)
- Zod validation schemas

### 7.2 Component Tests

- PlaceCard renders correctly with/without reports
- HalalBadge shows correct level
- ReportWarning shows correct confidence percentages
- Auth flow state transitions

### 7.3 Integration Tests

- Add place flow: form → validation → API → success dialog
- Verify flow: button → optimistic update → API → revert on failure
- Search flow: type → debounce → results → filter

### 7.4 E2E Tests — Maestro

```yaml
# flows/search_place.yaml
appId: com.halalnomad.app
---
- launchApp
- tapOn: "Search"
- inputText: "Tayyabs"
- tapOn: "Search" (button)
- assertVisible: "Tayyabs"
- tapOn: "Tayyabs"
- assertVisible: "Confirm Halal"
```

- Write flows for: onboarding, search, add place, verify, report, auth
- Run in CI via EAS Build + Maestro Cloud

---

## Phase 8: CI/CD & Release

### 8.1 EAS Configuration

```json
// eas.json
{
  "build": {
    "development": { "developmentClient": true },
    "preview": { "distribution": "internal" },
    "production": {}
  },
  "submit": {
    "production": {
      "ios": { "appleId": "...", "ascAppId": "..." },
      "android": { "serviceAccountKeyPath": "..." }
    }
  }
}
```

### 8.2 GitHub Actions CI

On every PR:
1. TypeScript type check
2. ESLint
3. Unit + component tests
4. EAS preview build (optional)

On merge to main:
1. All above
2. E2E tests
3. EAS production build
4. Submit to App Store / Play Store (manual approval)

### 8.3 OTA Updates

- Use EAS Update for JS-only changes (bug fixes, copy changes)
- Channel-based rollout: staging (team) → production (1%) → production (100%)
- Native changes require full build + store review

---

## Phase 9: Analytics & Growth

### 9.1 Analytics — PostHog

```
npm install posthog-react-native
```

Track:
- Screen views, search queries, place views
- Conversion funnel: browse → view place → verify/report/review
- Contributor engagement: points earned, places added
- Geographic coverage heatmap

### 9.2 Push Notifications

- "Your report was confirmed by 2 others"
- "New Halal places in [city you visited]"
- "You're 50 points from Guide tier!"
- Respect user preferences — granular opt-in

### 9.3 App Store Optimization

- Screenshots for both iOS and Android (localized)
- App Store description with keywords (Halal, Muslim travel, food finder)
- Privacy policy and terms of service
- App rating prompt (after 3rd positive interaction, not on first launch)

---

## Recommended Implementation Order

| Order | Phase | Effort | Impact |
|-------|-------|--------|--------|
| 1 | 1.1 TanStack Query + Zustand | Medium | Fixes all stale data issues, enables offline |
| 2 | 2.1–2.4 Image, FlashList, Skeletons, Pull-to-refresh | Medium | Immediate perceived quality jump |
| 3 | 4.1 Secure token storage | Small | Security baseline |
| 4 | 2.9 Search debounce + UX | Small | Prevents API hammering |
| 5 | 1.3 Error boundaries | Small | Prevents crashes |
| 6 | 3.2 Sentry | Small | Visibility into production issues |
| 7 | 5.1–5.2 Accessibility basics | Medium | Inclusivity, app store requirement |
| 8 | 2.8 Dark mode | Medium | Expected feature |
| 9 | 7.1–7.2 Unit + component tests | Medium | Confidence for future changes |
| 10 | 1.2 Form validation | Small | Better UX for contributors |
| 11 | 8.1–8.2 CI/CD | Medium | Sustainable shipping |
| 12 | 2.5–2.7 Bottom sheet, haptics, animations | Medium | Premium feel |
| 13 | 3.1 Offline support | Large | Core value prop for travellers |
| 14 | 6.1–6.2 i18n + RTL | Large | Unlocks Arabic/Bahasa/Turkish markets |
| 15 | 7.4 E2E tests | Medium | Full confidence |
| 16 | 9.1–9.3 Analytics, push, ASO | Medium | Growth |
