// Core data types for HalalNomad

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface Region extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

export type CoordinateSystem = 'WGS84' | 'GCJ02' | 'BD09';

export type HalalLevel = 1 | 2 | 3 | 4;

export const HALAL_LEVEL_LABELS: Record<HalalLevel, string> = {
  1: 'Reported',
  2: 'Community Verified',
  3: 'Photo Verified',
  4: 'Trusted',
};

// Canonical cuisine types — used by the scraper, the API, and the UI.
// When adding/changing: update CUISINE_LABELS and `scripts/seed/google_places.py`
// CUISINE_KEYWORDS together so what's stored matches what the UI knows how
// to display.
export type CuisineType =
  | 'chinese_muslim'
  | 'central_asian'
  | 'middle_eastern'
  | 'indian'
  | 'malay_indonesian'
  | 'japanese'
  | 'korean'
  | 'chinese'
  | 'thai'
  | 'vietnamese'
  | 'western'
  | 'seafood'
  | 'dessert'
  | 'other';

export const CUISINE_LABELS: Record<CuisineType, string> = {
  chinese_muslim: 'Chinese Muslim',
  central_asian: 'Central Asian',
  middle_eastern: 'Middle Eastern',
  indian: 'Indian',
  malay_indonesian: 'Malay / Indonesian',
  japanese: 'Japanese',
  korean: 'Korean',
  chinese: 'Chinese',
  thai: 'Thai',
  vietnamese: 'Vietnamese',
  western: 'Western',
  seafood: 'Seafood',
  dessert: 'Desserts',
  other: 'Other',
};

export type PlaceType =
  | 'restaurant'
  | 'grocery'
  | 'butcher'
  | 'bakery'
  | 'cafe'
  | 'street_food'
  | 'sweet_shop';

// Labels and icons for non-restaurant types — shown as a small badge on
// place cards / detail screens so a user looking for dinner doesn't get
// a halal supermarket as the top result without context.
export const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  restaurant: 'Restaurant',
  grocery: 'Grocery',
  butcher: 'Butcher',
  bakery: 'Bakery',
  cafe: 'Cafe',
  street_food: 'Street Food',
  sweet_shop: 'Sweets',
};

// Ionicons name per place type — undefined means no badge (default case).
export const PLACE_TYPE_ICONS: Partial<Record<PlaceType, string>> = {
  grocery: 'basket-outline',
  butcher: 'cut-outline',
  bakery: 'pizza-outline',
  cafe: 'cafe-outline',
  street_food: 'fast-food-outline',
  sweet_shop: 'ice-cream-outline',
};

export type PriceRange = 1 | 2 | 3 | 4;

export const PRICE_LABELS: Record<PriceRange, string> = {
  1: '$',
  2: '$$',
  3: '$$$',
  4: '$$$$',
};

export type ContributorTier = 'explorer' | 'guide' | 'ambassador' | 'legend';

export const TIER_THRESHOLDS: Record<ContributorTier, number> = {
  explorer: 0,
  guide: 200,
  ambassador: 1000,
  legend: 5000,
};

export const TIER_LABELS: Record<ContributorTier, string> = {
  explorer: 'Explorer',
  guide: 'Guide',
  ambassador: 'Ambassador',
  legend: 'Legend',
};

export const POINTS_TABLE = {
  add_place: 50,
  upload_photo: 10,
  verify_place: 15,
  write_review: 20,
  upload_certificate: 30,
  report_place: 10,
} as const;

export interface Place {
  id: string;
  name_en: string;
  name_local: string | null;
  address_en: string;
  address_local: string | null;
  latitude: number;
  longitude: number;
  coord_system: CoordinateSystem;
  cuisine_type: CuisineType;
  price_range: PriceRange | null;
  halal_level: HalalLevel;
  description: string | null;
  hours: string | null;
  photos: string[];
  added_by: string;
  last_verified_at: string | null;
  is_active: boolean;
  created_at: string;
  verification_count: number;
  closed_reports: number;
  not_halal_reports: number;
  is_featured: boolean;
  featured_tier: 'highlighted' | 'promoted' | 'spotlight' | null;
  place_type: PlaceType;
  city: string | null;
  country: string | null;
}

// ============================================
// Browse view — country/city aggregation
// ============================================

export interface CityCount {
  name: string;
  count: number;
}

export interface CountryGroup {
  country: string;
  total: number;
  cities: CityCount[];
}

// Country → emoji flag mapping for the Browse view header rows.
// Add new entries here when seeding new countries.
export const COUNTRY_FLAGS: Record<string, string> = {
  Japan: '🇯🇵',
  'South Korea': '🇰🇷',
  Thailand: '🇹🇭',
  Singapore: '🇸🇬',
  Taiwan: '🇹🇼',
  'Hong Kong': '🇭🇰',
  Vietnam: '🇻🇳',
  Philippines: '🇵🇭',
};

export interface Review {
  id: string;
  place_id: string;
  user_id: string;
  rating: number;
  text: string;
  created_at: string;
  user_display_name: string;
}

export interface Verification {
  id: string;
  place_id: string;
  user_id: string;
  type: 'confirm' | 'certificate' | 'flag_closed' | 'flag_not_halal';
  photo_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  avatar_url: string | null;
  points: number;
  tier: ContributorTier;
  created_at: string;
  notifications_enabled: boolean;
}

export interface SavedList {
  id: string;
  user_id: string;
  name: string;
  place_ids: string[];
  is_shared: boolean;
  created_at: string;
}

export type MapProviderType = 'google' | 'amap' | 'apple';
