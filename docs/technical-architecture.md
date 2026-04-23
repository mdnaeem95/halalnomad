# Technical Architecture

## Tech Stack

### Mobile App — React Native (Expo SDK 54)

**Core:**

- **React Native 0.81** with **Expo Router** (file-based routing)
- **TypeScript** (strict mode)

**State & Data:**

- **TanStack Query v5** — server state (caching, dedup, background refetch, optimistic updates, retry with exponential backoff)
- **Zustand** — client state (UI preferences, search filters, map provider)
- **React Hook Form + Zod** — form validation with type-safe schemas

**UI:**

- **expo-image** — image caching, blurhash placeholders, WebP/AVIF
- **@shopify/flash-list** — high-performance list rendering
- **moti** (Reanimated) — skeleton loaders and animations
- **@gorhom/bottom-sheet** — native bottom sheet interactions
- **expo-haptics** — tactile feedback
- **@expo/vector-icons (Ionicons)** — icon system
- Custom design system (colors, typography, spacing, shadows)

**Services:**

- **Supabase** (PostgreSQL + PostGIS + Auth + Storage)
- **react-native-maps** with map provider abstraction layer
- **expo-location**, **expo-clipboard**, **expo-image-picker**

**Why React Native / Expo over Flutter:**

- Larger ecosystem for map SDK integrations (Google Maps, AMap, Baidu all have React Native bindings)
- Easier to find developers
- Expo simplifies build/deploy pipeline, OTA updates for fast iteration

**Why Expo:**

- Managed workflow for faster development
- EAS Build for CI/CD
- OTA updates without app store review (critical for fast fixes while travelling users depend on the app)
- Can eject to bare workflow later if native module needs arise

### Backend — Supabase (PostgreSQL + Auth + Storage + Realtime)

**Why Supabase:**

- PostgreSQL with PostGIS extension for geospatial queries (find places within radius)
- Built-in auth (email, Google, Apple Sign-In)
- Row-level security for data protection
- Storage for user-uploaded photos
- Realtime subscriptions (for live verification updates)
- Generous free tier for MVP, scales predictably
- Open source — can self-host later if needed

**Alternative considered:** Firebase — rejected because Firestore's geospatial querying is weak compared to PostGIS, and vendor lock-in is higher.

### Map Integration Strategy

This is the most architecturally significant decision. The app must work worldwide, including in countries where Google Maps is restricted, inaccurate, or has limited POI data. We solve this with a provider abstraction layer.

```
┌──────────────────────────────────────────────────┐
│              Map Abstraction Layer                │
│         (unified API for the app)                │
├──────────┬──────────┬───────────┬────────────────┤
│ Google   │  AMap    │  Baidu    │  Future        │
│ Maps SDK │  SDK     │  Maps SDK │  (Yandex, etc) │
└──────────┴──────────┴───────────┴────────────────┘
```

**MapProvider interface:**

```typescript
interface MapProvider {
  name: string;
  region: string;                                     // e.g., "global", "CN", "RU"
  renderMap(region: Region): MapView;
  search(query: string, location: LatLng): Place[];
  getDirections(from: LatLng, to: LatLng): void;      // opens native app
  reverseGeocode(location: LatLng): Address;
  toStandardCoords(lat: number, lng: number): LatLng;  // normalise to WGS-84
}
```

**Why this matters globally:**

Different countries have different map ecosystems. Some examples:
- **China:** Google Maps blocked/inaccurate; AMap and Baidu Maps are dominant (use GCJ-02 / BD-09 coordinate systems)
- **Russia / Central Asia:** Yandex Maps has far better POI data than Google in many areas
- **South Korea:** Naver Maps is more accurate locally than Google Maps
- **General:** Some regions simply have poor Google Maps coverage

The abstraction layer normalises all coordinates to WGS-84 internally and handles conversion per provider transparently.

**Region detection and provider selection:**

- On app launch, detect user's region (via IP geolocation or GPS bounding box)
- Select the best available map provider for that region automatically
- Inform the user if a better regional provider is available (e.g., "AMap is more accurate in China")
- User can always override in settings
- Default to Google Maps for regions without a specialised provider

### Data Model

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│    users     │     │    places    │     │  verifications  │
├─────────────┤     ├──────────────┤     ├─────────────────┤
│ id           │────▶│ id           │◀────│ id              │
│ email        │     │ name_en      │     │ place_id        │
│ display_name │     │ name_local   │     │ user_id         │
│ points       │     │ address_en   │     │ type            │
│ tier         │     │ address_local│     │ photo_url       │
│ created_at   │     │ lat          │     │ status          │
│ avatar_url   │     │ lng          │     │ created_at      │
└─────────────┘     │ coord_system │     └─────────────────┘
                    │ cuisine_type │
                    │ price_range  │
                    │ halal_level  │     ┌─────────────────┐
                    │ description  │     │    reviews       │
                    │ hours        │     ├─────────────────┤
                    │ photos[]     │◀────│ id              │
                    │ added_by     │     │ place_id        │
                    │ last_verified│     │ user_id         │
                    │ is_active    │     │ rating          │
                    │ created_at   │     │ text            │
                    └──────────────┘     │ created_at      │
                                        └─────────────────┘

┌──────────────────┐
│   saved_lists    │
├──────────────────┤
│ id               │
│ user_id          │
│ name             │
│ place_ids[]      │
│ is_shared        │
│ created_at       │
└──────────────────┘
```

### Offline Architecture

- TanStack Query cache persisted to AsyncStorage via `@tanstack/query-async-storage-persister`
- 24-hour cache TTL — previously viewed places available instantly on app restart, even offline
- Network awareness via `@react-native-community/netinfo` synced with TanStack Query's `onlineManager`
- When offline: queries serve cached data, mutations queue, offline banner shown
- When back online: queued mutations fire, stale queries refetch automatically
- Future: explicit "Download City" feature for pre-caching entire city datasets

### Photo Storage & Moderation

- User photos uploaded to Supabase Storage (S3-compatible)
- Images compressed client-side before upload (max 1MB)
- Basic moderation: flag inappropriate content via reports, manual review for Halal certificate photos
- Future: automated image moderation via API

### Authentication

- Email + password (primary)
- Google Sign-In
- Apple Sign-In (required for iOS)
- Optional: anonymous browsing (no account needed to view places, account required to contribute)

### API Architecture

- Supabase auto-generated REST API for CRUD
- Edge Functions (Deno) for custom logic:
  - Point calculation on contribution
  - Verification level recalculation
  - Scheduled jobs (verification decay, inactive place flagging)
  - Push notification triggers

### Push Notifications

- Expo Push Notifications
- Triggers:
  - "Your submission was verified!"
  - "You've reached Guide tier!"
  - "New Halal places found near your saved city"

## Infrastructure

- **Hosting:** Supabase Cloud (managed)
- **CDN:** Supabase Storage CDN for images
- **CI/CD:** EAS Build + EAS Submit for app store deployment
- **Monitoring:** Sentry for crash reporting, Supabase dashboard for DB metrics
- **Analytics:** PostHog (open-source, privacy-friendly — important for Muslim audience that values data privacy)

## Cost Estimate (MVP)

| Service | Cost |
|---------|------|
| Supabase Pro | $25/month |
| EAS Build | Free tier (30 builds/month) |
| Apple Developer Account | $99/year |
| Google Play Developer | $25 one-time |
| Sentry | Free tier |
| PostHog | Free tier (1M events/month) |
| **Total (Year 1)** | **~$450** |
