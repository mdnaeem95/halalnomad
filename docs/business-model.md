# Business Model

## Revenue Streams

### 1. Freemium Subscription — "HalalNomad Premium"

**Free tier (core experience):**
- Browse and discover Halal places
- Add and verify places
- Earn contributor points
- Basic search and filters

**Premium tier (~$4.99/month or $29.99/year):**
- Offline city downloads (map tiles + place data)
- Advanced filters (zabihah-only, no-alcohol venues, dietary sub-preferences)
- Trip planning (saved lists, share with companions)
- Ad-free experience
- Priority support

**Why this works:** The free tier must be genuinely useful — travellers won't pay until they trust the app. Premium features are "nice to have" conveniences that power users and frequent travellers will pay for. Offline mode is the strongest premium hook since travellers often have connectivity issues.

**Revenue projection (conservative):**
- 10,000 MAU with 3% conversion = 300 subscribers
- At $30/year average = $9,000/year
- Scales linearly with user growth

### 2. Featured Listings (B2B)

Halal restaurants can pay for enhanced visibility:

| Tier | Price | What they get |
|------|-------|---------------|
| Highlighted | $10/month | Colored pin on map, "Featured" badge |
| Promoted | $25/month | Top of search results in area, larger card |
| Spotlight | $50/month | Banner in city view, featured in "Top Picks" |

**Why this works:** Restaurant owners in tourist areas already pay for visibility on platforms like TripAdvisor and Google. A Halal-specific platform with a targeted Muslim traveller audience is highly valuable to them.

**Revenue projection:**
- 50 restaurants at average $20/month = $12,000/year
- Grows as coverage expands to more cities

### 3. Advertising (Tasteful, Relevant)

- In-app banner ads from relevant brands (Halal food brands, Muslim travel agencies, Islamic finance, modest fashion)
- Limited to 1 ad per session, not intrusive
- No ads for premium subscribers
- Served via Google AdMob or a Muslim-focused ad network

**Revenue projection:**
- At 10,000 MAU: ~$500-1,000/year (low CPM for niche)
- Better as a supplement than a primary model

### 4. Tourism Board / Destination Partnerships (Future)

- Countries and cities competing for Muslim tourist spending can partner with us
- Offer "Muslim-Friendly City Guide" packages
- Featured destination campaigns
- Data insights on Muslim traveller patterns (anonymized)

**Examples:** Malaysia, Turkey, Japan, South Korea have all invested in Muslim-friendly tourism initiatives. They need channels to reach this audience.

**Revenue projection:** $5,000-50,000 per partnership depending on scope.

### 5. Affiliate & Booking Commission (Future)

- Link to Halal-friendly hotels (HalalBooking, Booking.com affiliate)
- Restaurant reservation commissions where applicable
- Halal food delivery partnerships in supported cities

## Cost Structure

### Fixed Costs (Monthly)

| Item | Cost |
|------|------|
| Supabase Pro | $25 |
| Apple Developer | ~$8 (annualized) |
| Domain + email | ~$10 |
| **Total fixed** | **~$43/month** |

### Variable Costs (Scale with usage)

| Item | Trigger |
|------|---------|
| Supabase usage overage | >8GB DB, >250GB bandwidth |
| Map API calls | Google Maps charges after free tier (28,000 loads/month free) |
| AMap API | Free tier generous, paid after high volume |
| Image storage | ~$0.02/GB on Supabase |
| EAS Build | Free for 30 builds/month, $99/month for more |

### Break-Even Analysis

- Fixed costs: ~$500/year
- To break even: ~17 premium subscribers OR 3 featured restaurants
- This is very achievable even at small scale

## Monetization Timeline

| Phase | Revenue Streams | Status |
|-------|----------------|--------|
| v1.0 | Premium subscription + Featured listings | **IMPLEMENTED** — RevenueCat for subscriptions, DB-level featured listings with badge + sort boost |
| v1.1 | Ads (AdMob) | Planned |
| v2.0 | Tourism partnerships + Affiliates | Planned |

### Implementation Details

**Premium Subscription (RevenueCat):**
- Monthly: $4.99/mo
- Yearly: $29.99/yr (best value)
- Handles App Store + Play Store billing, receipt validation, cross-platform
- Paywall screen with feature breakdown, pricing cards, restore purchases
- Premium status checked via `usePremium()` hook

**Featured Listings (Supabase):**
- `is_featured` + `featured_tier` columns on places table
- 3 tiers: highlighted, promoted, spotlight
- Featured places sort to top of nearby and search results
- Featured badge displayed on cards and detail screen
- Expiry date tracked via `featured_expires_at`

## Pricing Philosophy

1. **The core experience must always be free.** Finding Halal food is a real need, not a luxury. Paywalling basic discovery would kill adoption.
2. **Premium is for power users and frequent travellers.** Convenience features, not core functionality.
3. **B2B revenue should grow faster than B2C.** Featured listings and partnerships scale better and don't burden individual users.
4. **Respect the audience.** No predatory ads, no data selling, no dark patterns. Muslim travellers value trust — earn it.

## Potential Funding Sources

If we want to accelerate beyond bootstrapping:

- **Muslim-focused VC/angel investors** — growing ecosystem (e.g., Affinis Labs, Wahed Invest network)
- **Islamic economy accelerators** — programs focused on Halal economy startups
- **Tourism board grants** — some countries offer grants for apps that drive tourism
- **Crowdfunding** — LaunchGood (Muslim crowdfunding platform) for community-backed launch
