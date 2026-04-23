# HalalNomad — App Store Launch Checklist

## 1. Assets & Branding

- [Done] Export SVGs to PNG:
  - [Done] `icon.svg` → `assets/icon.png` (1024x1024, no transparency, no alpha for iOS)
  - [Done] `splash.svg` → `assets/splash-icon.png` (1284x2778)
  - [Done] `adaptive-icon.svg` → `assets/adaptive-icon.png` (1024x1024)
- [Not needed] Generate favicon from icon: `assets/favicon.png` (48x48)
- [Done] Prepare App Store screenshots (required sizes):
  - [Done] iPhone 6.9" (1320x2868) — iPhone 15 Pro Max
  - [Done] iPhone 6.7" (1290x2796) — iPhone 14 Pro Max
  - [Done] iPad 13" (2064x2752) — if supporting tablet
  - [Done] Minimum 3 screenshots, recommended 5-6 per device size
  - [Done] Screens to capture: Explore map, List view with places, Place detail, Search with filters, Profile with points
- [ ] Prepare Play Store screenshots:
  - [ ] Phone (1080x1920 minimum)
  - [ ] Feature graphic (1024x500)

## 2. Database Migrations

Run these in Supabase SQL Editor (in order):

- [Done] `migration-001-fix-profiles-rls.sql` (if not already run)
- [Done] `migration-002-fix-trigger.sql` (if not already run)
- [Done] `migration-003-report-counts.sql` (if not already run)
- [Done] `migration-004-featured-listings.sql` (if not already run)
- [Done] `migration-005-push-token.sql`
- [Done] `seed-data.sql` — verify 51 places are populated

## 3. Environment & API Keys

- [Done] Supabase URL + anon key (already configured)
- [Done] Google Maps API key (already in app.json)
- [Done] Sentry DSN (already configured)
- [Done] PostHog API key (already configured)
- [Done] RevenueCat API keys (already configured)
  - [Done] Create products in App Store Connect: monthly ($4.99), yearly ($29.99)
  - [ ] Create products in Google Play Console: matching prices
  - [ ] Link products to RevenueCat offerings
  - [ ] Verify entitlement name matches: `HalalNomad Premium`

## 4. App Store Connect Setup (iOS)

- [Done] Create App ID in Apple Developer portal
- [Done] Register bundle ID: `com.halalnomad.app`
- [Done] Create app in App Store Connect
- [ ] Fill in app metadata:
  - [Done] App name: `HalalNomad`
  - [Done] Subtitle: `Halal food, anywhere in the world`
  - [Done] Category: Primary — Food & Drink, Secondary — Travel
  - [Done] Description (see below)
  - [Done] Keywords: halal, muslim, travel, food, restaurant, finder, verified, nomad, halal food
  - [Done] Support URL
  - [Done] Privacy policy URL
  - [Done] Marketing URL (optional)
- [Done] Age rating: 4+ (no objectionable content)
- [Done] Upload screenshots
- [Done] Configure in-app purchases (monthly + yearly)
- [Done] Enable push notifications in Certificates, Identifiers & Profiles

## 5. Google Play Console Setup (Android)

- [ ] Create app in Google Play Console
- [ ] Package name: `com.halalnomad.app`
- [ ] Fill in store listing:
  - [ ] App name: `HalalNomad`
  - [ ] Short description (80 chars): `Find verified Halal food worldwide. Community-powered, traveller-first.`
  - [ ] Full description (see below)
  - [ ] Category: Food & Drink
  - [ ] Tags: Halal, Muslim, Travel, Food Finder
- [ ] Content rating questionnaire (complete in console)
- [ ] Data safety form:
  - [ ] Location: collected for nearby places (not shared)
  - [ ] Email: collected for auth (not shared)
  - [ ] Photos: optional upload (stored on our servers)
  - [ ] No data sold to third parties
- [ ] Upload screenshots + feature graphic
- [ ] Configure in-app products (monthly + yearly)
- [ ] Set up internal testing track first

## 6. Legal

- [Done] Privacy policy — must cover:
  - [Done] What data is collected (email, location, photos, usage analytics)
  - [Done] How data is stored (Supabase, Sentry, PostHog — all with data processing agreements)
  - [Done] Data retention policy
  - [Done] User rights (delete account, export data)
  - [Done] Third-party services (Google Maps, RevenueCat, Sentry, PostHog)
  - [Done] Cookie/tracking disclosure
  - [Done] GDPR compliance (for EU users)
  - [Done] Contact information
- [Done] Terms of service — must cover:
  - [Done] User-generated content policy
  - [Done] Community guidelines (accurate reporting, no abuse)
  - [Done] Subscription terms (auto-renewal, cancellation)
  - [Done] Limitation of liability
- [Done] Host both at a public URL (can use a simple GitHub Pages site)

## 7. Build & Submit

```bash
# Install EAS CLI if not already
npm install -g eas-cli

# Login to Expo
eas login

# Configure credentials (first time)
eas credentials

# Build for both platforms
eas build --profile production --platform all

# Submit to stores
eas submit --profile production --platform ios
eas submit --profile production --platform android
```

- [ ] Fill in EAS credentials in `eas.json`:
  - [ ] iOS: `appleId`, `ascAppId`, `appleTeamId`
  - [ ] Android: `serviceAccountKeyPath` (Google Play service account JSON)
- [ ] Run production build
- [ ] Test production build on physical device before submitting
- [ ] Submit to App Store (iOS)
- [ ] Submit to Play Store (Android — internal testing first)

## 8. Pre-Launch Testing

- [ ] Test on physical iPhone (not just simulator)
- [ ] Test on physical Android device
- [ ] Test sign up → verify email → sign in flow
- [ ] Test add place → appears on map
- [ ] Test verify → points awarded → tier updates
- [ ] Test report → confidence indicator updates
- [ ] Test search with cuisine filters
- [ ] Test copy address to clipboard
- [ ] Test get directions (opens native maps)
- [ ] Test offline mode (enable airplane mode, browse cached data)
- [ ] Test language switching (English → Arabic → Turkish → Bahasa)
- [ ] Test dark mode toggle
- [ ] Test paywall screen renders correctly
- [ ] Verify Sentry receives test events
- [ ] Verify PostHog receives test events

## 9. Post-Submission

- [ ] Monitor App Store review (typically 24-48 hours)
- [ ] Monitor Play Store review (typically 1-3 days for first submission)
- [ ] Respond to any rejection feedback promptly
- [ ] Once approved, set release date or release immediately
- [ ] Announce launch on social media / Muslim travel communities

---

## App Store Description (Draft)

**Short description (80 chars):**
Find verified Halal food worldwide. Community-powered, traveller-first.

**Full description:**

HalalNomad helps Muslim travellers find verified Halal food anywhere in the world.

Travelling to Tokyo, Beijing, Paris, or Istanbul? Stop guessing and start finding. HalalNomad shows you Halal restaurants nearby with community-verified trust scores, dual-language addresses (so you can show them to a taxi driver), and one-tap directions.

DISCOVER
- Browse Halal places on a map or list view
- 50+ verified restaurants across 13 cities worldwide
- Search by cuisine: Chinese Muslim, Turkish, Pakistani, Japanese, and more
- Dual-language display — see names and addresses in English + local script

TRUST
- Community verification system — places earn trust through multiple confirmations
- Report confidence scoring — see how likely a place is still open and Halal
- Photo-verified Halal certificates
- No fake reviews, no paid placements disguised as organic

CONTRIBUTE
- Add places you discover while travelling
- Verify and confirm existing listings
- Earn points and climb contributor tiers: Explorer → Guide → Ambassador → Legend
- Help fellow Muslim travellers eat well

BUILT FOR TRAVELLERS
- Works in countries where Google Maps is restricted
- Offline access — previously viewed places available without internet
- Copy addresses to clipboard for taxi drivers
- 4 languages: English, Arabic, Turkish, Bahasa Melayu

PREMIUM (optional)
- Offline city downloads
- Advanced dietary filters
- Trip planning with saved lists
- Ad-free experience

HalalNomad is built by travellers, for travellers. Every place is added and verified by real people — not scraped from the internet.

Bismillah, let's eat.
