# HalalNomad — Product Specification

## Vision

A mobile-first app that helps Muslim travellers instantly discover verified Halal food and places in foreign countries, powered by a community of fellow travellers.

## Problem Statement

Muslim travellers worldwide struggle to find Halal food in unfamiliar cities. Whether in Tokyo, Paris, Beijing, or São Paulo, the experience is the same: unreliable Google results, language barriers, and no way to know if a place is genuinely Halal. Existing apps either:

- Have thin coverage outside a handful of regions (NA, Southeast Asia)
- Treat Halal food as an afterthought in a larger lifestyle app
- Lack verification, leading to unreliable listings
- Only support Google Maps, which doesn't work everywhere (e.g., blocked/inaccurate in China, limited POI data in parts of Africa and Central Asia)

Many countries have significant Halal food infrastructure that is invisible to international travellers due to language barriers and fragmented information — from Hui Muslim restaurants across China to Halal butchers in European cities to street food in sub-Saharan Africa.

## Target Users

### Primary: Muslim Travellers

- Travelling internationally for tourism or business
- Need to find Halal food quickly and reliably in unfamiliar cities
- Comfortable with English as the app language
- May have limited local connectivity or no Google Maps access

### Secondary: Local Contributors

- Muslim residents or frequent visitors to a city
- Want to help fellow Muslims find Halal options
- Motivated by community contribution and rewards

### Tertiary: Halal Restaurant Owners

- Want visibility among Muslim travellers
- Willing to pay for featured placement

## Core Features

### 1. Map-Based Discovery

- Open the app → see Halal places near you on a map
- **Adaptive map provider support:**
  - Google Maps (default for most of the world)
  - Apple Maps (alternative global option)
  - Region-specific providers where they are more accurate or where Google Maps has limitations:
    - AMap/Gaode Maps (China)
    - Baidu Maps (China)
    - Yandex Maps (Russia/Central Asia — future)
  - Extensible architecture to add more regional providers as needed
- Auto-detect region and suggest the best available map provider
- User can manually switch map provider in settings

### 2. Place Listings

Each place includes:

- Name (in English + local script)
- Address (in English + local script, with copy-to-clipboard for showing to taxi drivers)
- Halal status with verification level (see below)
- Photos (user-submitted)
- Brief description / what to expect
- Menu highlights (optional)
- Opening hours
- Price range indicator ($ / $$ / $$$ / $$$$)
- Distance from current location
- Directions button (opens in selected map provider)

### 3. Halal Verification System

Tiered trust model:

| Level | Label | Criteria |
|-------|-------|----------|
| 1 | Reported | Single user submission, unverified |
| 2 | Community Verified | 3+ independent users confirm Halal status |
| 3 | Photo Verified | Halal certificate photo uploaded and reviewed |
| 4 | Trusted | Verified by a Trusted Reviewer (see contributor tiers) |

- Places degrade over time if not re-confirmed (e.g., after 12 months, verification drops a level)
- Users can flag places as "no longer Halal" or "closed"

### 4. Search & Filters

- Search by cuisine type (Chinese-Muslim, Middle Eastern, Turkish, Indian, Pakistani, Indonesian, etc.)
- Filter by verification level
- Filter by price range
- Filter by distance
- Filter by "open now"
- Filter by dietary sub-preferences (no alcohol served, zabihah-only, seafood-only)

### 5. Contributor System & Rewards

**Actions that earn points:**

| Action | Points |
|--------|--------|
| Add a new place | 50 |
| Upload a photo | 10 |
| Confirm/verify an existing place | 15 |
| Write a review | 20 |
| Upload Halal certificate photo | 30 |
| Report a closed/non-Halal place | 10 |

**Contributor Tiers:**

| Tier | Requirement | Perks |
|------|-------------|-------|
| Explorer | 0 pts | Basic access |
| Guide | 200 pts | Badge, profile visibility |
| Ambassador | 1000 pts | Trusted Reviewer status, early features |
| Legend | 5000 pts | Premium free, name on leaderboard |

**Reward redemption (future):**

- Partner discounts at listed restaurants
- Premium subscription credit
- Charitable donation option (donate reward value to a cause)

### 6. Offline Mode

- Save areas/cities for offline access
- Cached map tiles + place data
- Queue contributions for upload when back online
- Critical for travellers with limited data or in areas with poor connectivity

### 7. Trip Planning (Premium)

- Save places to custom lists (e.g., "Beijing Trip", "Istanbul Favourites")
- Share lists with travel companions
- Suggested Halal-friendly itineraries for popular destinations

## Language

- **Primary UI language:** English
- **Place names:** Displayed in English (transliteration) + local script
- **Addresses:** Dual-language display with copy button
- **Future:** UI translations for Arabic, Bahasa, Turkish, Urdu based on demand

## Platform

- iOS and Android
- Mobile-first (no web app in v1)
