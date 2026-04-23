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

export type CuisineType =
  | 'chinese_muslim'
  | 'middle_eastern'
  | 'turkish'
  | 'indian'
  | 'pakistani'
  | 'indonesian'
  | 'malaysian'
  | 'african'
  | 'central_asian'
  | 'japanese'
  | 'korean'
  | 'thai'
  | 'mediterranean'
  | 'western'
  | 'other';

export const CUISINE_LABELS: Record<CuisineType, string> = {
  chinese_muslim: 'Chinese Muslim',
  middle_eastern: 'Middle Eastern',
  turkish: 'Turkish',
  indian: 'Indian',
  pakistani: 'Pakistani',
  indonesian: 'Indonesian',
  malaysian: 'Malaysian',
  african: 'African',
  central_asian: 'Central Asian',
  japanese: 'Japanese',
  korean: 'Korean',
  thai: 'Thai',
  mediterranean: 'Mediterranean',
  western: 'Western',
  other: 'Other',
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
}

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
