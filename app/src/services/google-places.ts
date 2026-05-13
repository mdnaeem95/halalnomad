// Google Places API (New) v1 wrapper for the Add Place autocomplete flow.
//
// Why this exists: the original Add Place form asked users to drop a pin
// on a map and type two languages of address by hand. Both were painful;
// autocomplete replaces them with "type place name → pick → done".
//
// We use the v1 Places API (places.googleapis.com), not the legacy
// maps.googleapis.com/maps/api endpoints. v1 is faster, returns
// structured fields, and supports session tokens cleanly.
//
// Billing: a session token covers one autocomplete + one details call as
// a single billable session (~$2.83 / 1000). Generate a fresh token at
// the start of each typing-to-selection cycle.

import { LatLng } from '../types';

const PLACES_API_BASE = 'https://places.googleapis.com/v1';
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// Country (as returned by Google's en formattedAddress) → language code
// for the second details fetch. If a country isn't in this map we skip
// the second fetch (no useful local-script value to populate).
const LOCAL_LANGUAGE_BY_COUNTRY: Record<string, string> = {
  Japan: 'ja',
  'South Korea': 'ko',
  Thailand: 'th',
  Vietnam: 'vi',
  Taiwan: 'zh-TW',
  'Hong Kong': 'zh-HK',
  China: 'zh-CN',
  Malaysia: 'ms',
};

// Google place types → our CuisineType. Only mapped where the inference
// is unambiguous; mixed cuisines (just "restaurant") stay unmapped so
// the user picks.
const CUISINE_BY_TYPE: Record<string, string> = {
  japanese_restaurant: 'japanese',
  korean_restaurant: 'korean',
  thai_restaurant: 'thai',
  chinese_restaurant: 'chinese',
  vietnamese_restaurant: 'vietnamese',
  indian_restaurant: 'indian',
  middle_eastern_restaurant: 'middle_eastern',
  seafood_restaurant: 'seafood',
};

// Google's PriceLevel enum → our 1-4 scale.
const PRICE_LEVEL_MAP: Record<string, number> = {
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

export interface PlaceSuggestion {
  placeId: string;
  mainText: string;
  secondaryText: string;
  types: string[];
}

export interface PlaceDetails {
  placeId: string;
  nameEn: string;
  nameLocal: string | null;
  addressEn: string;
  addressLocal: string | null;
  latitude: number;
  longitude: number;
  priceLevel: number | null;
  city: string | null;
  country: string | null;
  cuisineType: string | null;
}

// Cheap unique token — Google just needs an opaque per-session string.
export function generateSessionToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function searchPlaces(
  query: string,
  bias: LatLng | null,
  sessionToken: string
): Promise<PlaceSuggestion[]> {
  if (!API_KEY || !query.trim()) return [];

  const body: Record<string, unknown> = {
    input: query,
    languageCode: 'en',
    sessionToken,
    includedPrimaryTypes: ['restaurant', 'cafe', 'bakery', 'meal_takeaway', 'food'],
  };
  if (bias) {
    body.locationBias = {
      circle: {
        center: { latitude: bias.latitude, longitude: bias.longitude },
        radius: 50000,
      },
    };
  }

  try {
    const response = await fetch(`${PLACES_API_BASE}/places:autocomplete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) return [];
    const data = await response.json();
    type RawSuggestion = {
      placePrediction?: {
        placeId: string;
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
        types?: string[];
      };
    };
    return ((data.suggestions ?? []) as RawSuggestion[])
      .filter((s) => s.placePrediction)
      .map((s) => ({
        placeId: s.placePrediction!.placeId,
        mainText: s.placePrediction!.structuredFormat?.mainText?.text ?? '',
        secondaryText: s.placePrediction!.structuredFormat?.secondaryText?.text ?? '',
        types: s.placePrediction!.types ?? [],
      }));
  } catch {
    return [];
  }
}

const DETAILS_FIELD_MASK =
  'id,displayName,formattedAddress,location,priceLevel,types,addressComponents';

interface RawPlaceResponse {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  priceLevel?: string;
  types?: string[];
  addressComponents?: { longText?: string; types?: string[] }[];
}

async function fetchPlaceInLanguage(
  placeId: string,
  languageCode: string,
  sessionToken: string,
  fieldMask: string = DETAILS_FIELD_MASK
): Promise<RawPlaceResponse | null> {
  if (!API_KEY) return null;
  try {
    const url = `${PLACES_API_BASE}/places/${placeId}?languageCode=${languageCode}&sessionToken=${sessionToken}`;
    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
    });
    if (!response.ok) return null;
    return (await response.json()) as RawPlaceResponse;
  } catch {
    return null;
  }
}

export async function getPlaceDetails(
  placeId: string,
  sessionToken: string
): Promise<PlaceDetails | null> {
  const en = await fetchPlaceInLanguage(placeId, 'en', sessionToken);
  if (!en) return null;

  const components = en.addressComponents ?? [];
  const city =
    components.find((c) => c.types?.includes('locality'))?.longText ?? null;
  const country =
    components.find((c) => c.types?.includes('country'))?.longText ?? null;

  let nameLocal: string | null = null;
  let addressLocal: string | null = null;
  const localLang = country ? LOCAL_LANGUAGE_BY_COUNTRY[country] : null;
  if (localLang) {
    const local = await fetchPlaceInLanguage(
      placeId,
      localLang,
      sessionToken,
      'displayName,formattedAddress'
    );
    if (local) {
      const localName = local.displayName?.text ?? '';
      const localAddr = local.formattedAddress ?? '';
      if (localName && localName !== en.displayName?.text) nameLocal = localName;
      if (localAddr && localAddr !== en.formattedAddress) addressLocal = localAddr;
    }
  }

  const priceLevel = en.priceLevel ? PRICE_LEVEL_MAP[en.priceLevel] ?? null : null;

  let cuisineType: string | null = null;
  for (const t of en.types ?? []) {
    if (CUISINE_BY_TYPE[t]) {
      cuisineType = CUISINE_BY_TYPE[t];
      break;
    }
  }

  return {
    placeId: en.id ?? placeId,
    nameEn: en.displayName?.text ?? '',
    nameLocal,
    addressEn: en.formattedAddress ?? '',
    addressLocal,
    latitude: en.location?.latitude ?? 0,
    longitude: en.location?.longitude ?? 0,
    priceLevel,
    city,
    country,
    cuisineType,
  };
}
