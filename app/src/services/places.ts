// expo-file-system v19 rewrote the public API; readAsStringAsync +
// EncodingType moved behind /legacy. Don't drop the suffix or
// FileSystem.EncodingType becomes undefined at runtime.
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../lib/supabase';
import { sanitizeText, sanitizeMultiline } from '../lib/sanitize';
import {
  CityCount,
  CountryGroup,
  CuisineType,
  HalalLevel,
  LatLng,
  Place,
  PriceRange,
  Review,
  Verification,
} from '../types';

interface FetchPlacesOptions {
  location: LatLng;
  radiusKm?: number;
  cuisineType?: CuisineType;
  minHalalLevel?: HalalLevel;
  priceRange?: PriceRange;
  limit?: number;
}

/**
 * Fetch places near a location via PostGIS earth_distance.
 *
 * Returns an empty array when nothing is in range — callers MUST handle
 * the empty state. The previous implementation silently fell back to
 * "recently added places worldwide" when the radius came back empty,
 * which surfaced as cards pretending to be nearby. That's worse than
 * an empty state because it looks plausible.
 */
export async function fetchNearbyPlaces(options: FetchPlacesOptions): Promise<Place[]> {
  const { location, radiusKm = 50, cuisineType, minHalalLevel, limit = 50 } = options;

  try {
    let query = supabase.rpc('nearby_places', {
      lat: location.latitude,
      lng: location.longitude,
      radius_km: radiusKm,
    });

    if (cuisineType) {
      query = query.eq('cuisine_type', cuisineType);
    }
    if (minHalalLevel) {
      query = query.gte('halal_level', minHalalLevel);
    }

    const { data, error } = await query.limit(limit);
    if (error) return [];
    return (data as Place[]) ?? [];
  } catch {
    return [];
  }
}

/**
 * Fetch a single place by ID with full details.
 */
export async function fetchPlace(id: string): Promise<Place | null> {
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .eq('id', id)
    .eq('is_active', true)
    .single();

  if (error) return null;
  return data as Place;
}

/**
 * Aggregate active places into a country → city tree with counts.
 * Powers the Browse view on the Explore tab.
 *
 * Paginated because PostgREST caps each .select() at 1,000 rows by
 * default — without paging, cities late in the natural row order
 * (e.g. Manila) get truncated and show wildly under-counted. Once
 * the table grows past ~10k rows, swap this for an RPC that does
 * the GROUP BY server-side.
 */
export async function fetchCountriesWithCities(): Promise<CountryGroup[]> {
  const PAGE_SIZE = 1000;
  const rows: Array<{ city: string; country: string }> = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('places')
      .select('city, country')
      .eq('is_active', true)
      .not('city', 'is', null)
      .not('country', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    const batch = (data ?? []) as Array<{ city: string; country: string }>;
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  const groups = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!groups.has(row.country)) groups.set(row.country, new Map());
    const cityMap = groups.get(row.country)!;
    cityMap.set(row.city, (cityMap.get(row.city) ?? 0) + 1);
  }

  const out: CountryGroup[] = [];
  for (const [country, cityMap] of groups) {
    const cities: CityCount[] = Array.from(cityMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    const total = cities.reduce((sum, c) => sum + c.count, 0);
    out.push({ country, total, cities });
  }
  out.sort((a, b) => b.total - a.total);
  return out;
}

/**
 * Fetch all active places in a given city, sorted by halal_level desc
 * then by verification count, so the most trustworthy show first.
 */
export async function fetchPlacesByCity(city: string): Promise<Place[]> {
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .eq('is_active', true)
    .eq('city', city)
    .order('halal_level', { ascending: false })
    .order('verification_count', { ascending: false })
    .limit(500);

  if (error) throw error;
  return (data as Place[]) ?? [];
}

/**
 * Search places by text query.
 */
export async function searchPlaces(query: string, _location?: LatLng): Promise<Place[]> {
  // Text search on name_en, name_local, and address_en
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .eq('is_active', true)
    .or(`name_en.ilike.%${query}%,name_local.ilike.%${query}%,address_en.ilike.%${query}%`)
    .limit(30);

  if (error) throw error;
  return (data as Place[]) ?? [];
}

interface AddPlaceInput {
  name_en: string;
  name_local?: string;
  address_en: string;
  address_local?: string;
  latitude: number;
  longitude: number;
  cuisine_type: CuisineType;
  price_range?: PriceRange;
  description?: string;
  hours?: string;
  photos?: string[];
  // Populated from PlacesAutocomplete selection (not user-typed). Left
  // undefined for manual submissions; the Browse view filters them out
  // until someone moderates and backfills.
  city?: string;
  country?: string;
  // When autocomplete was used, the Google place_id. Drives both dedup
  // (matched against existing seeded rows via places.sources) and the
  // provenance record we write on insert.
  google_place_id?: string;
}

/**
 * Add a new Halal place. Automatically sets halal_level to 1 (Reported).
 */
export async function addPlace(input: AddPlaceInput, userId: string): Promise<Place> {
  // Sanitize all user-provided text
  const sanitized = {
    ...input,
    name_en: sanitizeText(input.name_en),
    name_local: input.name_local ? sanitizeText(input.name_local) : undefined,
    address_en: sanitizeText(input.address_en),
    address_local: input.address_local ? sanitizeText(input.address_local) : undefined,
    description: input.description ? sanitizeMultiline(input.description) : undefined,
    hours: input.hours ? sanitizeText(input.hours) : undefined,
    city: input.city ? sanitizeText(input.city) : undefined,
    country: input.country ? sanitizeText(input.country) : undefined,
  };
  // Strip the synthetic field before insert — it's not a column.
  delete (sanitized as { google_place_id?: string }).google_place_id;

  // Always write a sources record so future dedup logic has something
  // to match against. Autocomplete submissions inherit Google's place_id;
  // manual submissions are tagged user_contribution with the user_id.
  const sourceRecord = input.google_place_id
    ? {
        source: 'google_places',
        source_id: input.google_place_id,
        imported_at: new Date().toISOString(),
      }
    : {
        source: 'user_contribution',
        source_id: userId,
        imported_at: new Date().toISOString(),
      };

  const { data, error } = await supabase
    .from('places')
    .insert({
      ...sanitized,
      coord_system: 'WGS84',
      halal_level: 1,
      added_by: userId,
      is_active: true,
      photos: input.photos ?? [],
      verification_count: 0,
      closed_reports: 0,
      not_halal_reports: 0,
      is_featured: false,
      featured_tier: null,
      sources: [sourceRecord],
    })
    .select()
    .single();

  if (error) throw error;

  // Award points for adding a place
  await supabase.rpc('award_points', { user_id: userId, amount: 50 });

  return data as Place;
}

/**
 * Check whether a place matching the given Google place_id or close to the
 * given coordinates already exists. Used by the Add Place flow to surface
 * "this place is already on HalalNomad" before a duplicate row lands.
 *
 * Two-layer match, in order:
 *   1. By Google place_id (catches autocomplete picks that map to seeded
 *      rows or earlier user adds — most common case).
 *   2. By coordinates within 50 m (catches manual submissions and any
 *      autocomplete pick whose place_id didn't tie back to anything).
 *
 * Returns the first match found, or null if either layer fails or
 * matches nothing. A network failure here is treated as "no match" — we
 * don't want to block submission on a dedup-check error.
 */
export async function findExistingPlace(opts: {
  googlePlaceId?: string;
  lat?: number;
  lng?: number;
}): Promise<Place | null> {
  if (opts.googlePlaceId) {
    try {
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .eq('is_active', true)
        .contains('sources', [{ source_id: opts.googlePlaceId }])
        .limit(1);
      if (!error && data && data.length > 0) return data[0] as Place;
    } catch {
      // fall through to coord-based check
    }
  }

  if (opts.lat != null && opts.lng != null) {
    try {
      const { data, error } = await supabase.rpc('nearby_places', {
        lat: opts.lat,
        lng: opts.lng,
        radius_km: 0.05,
      });
      if (!error && data && data.length > 0) {
        // Filter to active places — nearby_places already filters, but
        // be defensive in case its definition changes.
        const active = (data as Place[]).filter((p) => p.is_active);
        if (active.length > 0) return active[0];
      }
    } catch {
      // swallow; caller treats null as "no match found"
    }
  }

  return null;
}

/**
 * Fetch the set of verification types this user has submitted for this place.
 * Used client-side to disable already-used actions (confirm / flag_closed / flag_not_halal).
 */
export async function fetchUserVerifications(
  placeId: string,
  userId: string
): Promise<Verification['type'][]> {
  const { data, error } = await supabase
    .from('verifications')
    .select('type')
    .eq('place_id', placeId)
    .eq('user_id', userId);

  if (error) return [];
  return (data ?? []).map((row: { type: Verification['type'] }) => row.type);
}

/**
 * Verify/confirm a place's Halal status.
 */
export async function verifyPlace(
  placeId: string,
  userId: string,
  type: Verification['type'],
  photoUrl?: string
): Promise<void> {
  const { error } = await supabase.from('verifications').insert({
    place_id: placeId,
    user_id: userId,
    type,
    photo_url: photoUrl ?? null,
    status: type === 'certificate' ? 'pending' : 'approved',
  });

  if (error) throw error;

  // Update verification count and halal level
  if (type === 'confirm') {
    await supabase.rpc('increment_verification', { p_place_id: placeId });
    await supabase.rpc('award_points', { user_id: userId, amount: 15 });
  } else if (type === 'certificate') {
    await supabase.rpc('award_points', { user_id: userId, amount: 30 });
  } else {
    // flag_closed or flag_not_halal
    await supabase.rpc('increment_report_count', { p_place_id: placeId, p_type: type });
    await supabase.rpc('award_points', { user_id: userId, amount: 10 });
  }
}

/**
 * Fetch reviews for a place.
 */
export async function fetchReviews(placeId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*, profiles(display_name)')
    .eq('place_id', placeId)
    .order('created_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: row.id,
    place_id: row.place_id,
    user_id: row.user_id,
    rating: row.rating,
    text: row.text,
    created_at: row.created_at,
    user_display_name: row.profiles?.display_name ?? 'Anonymous',
  }));
}

/**
 * Add a review for a place.
 */
export async function addReview(
  placeId: string,
  userId: string,
  rating: number,
  text: string
): Promise<void> {
  const { error } = await supabase.from('reviews').insert({
    place_id: placeId,
    user_id: userId,
    rating,
    text: sanitizeMultiline(text),
  });

  if (error) throw error;
  await supabase.rpc('award_points', { user_id: userId, amount: 20 });
}

/**
 * Upload a photo and return the public URL.
 *
 * Why not fetch(uri).blob(): React Native's blob polyfill returns a
 * 0-byte blob for local file:// URIs on iOS — the upload succeeds, but
 * the stored file is empty (verified in storage with content-length: 0).
 * Reading via expo-file-system as base64 + decoding to a Uint8Array is
 * the documented Supabase-RN pattern.
 */
export async function uploadPhoto(
  uri: string,
  userId: string,
  folder: string = 'places'
): Promise<string> {
  const fileName = `${folder}/${userId}/${Date.now()}.jpg`;

  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const { error } = await supabase.storage.from('photos').upload(fileName, bytes, {
    contentType: 'image/jpeg',
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from('photos').getPublicUrl(fileName);
  return data.publicUrl;
}
