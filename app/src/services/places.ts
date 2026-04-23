import { supabase } from '../lib/supabase';
import { sanitizeText, sanitizeMultiline } from '../lib/sanitize';
import {
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
 * Fetch places near a location. Uses PostGIS earth_distance for radius queries.
 * Falls back to fetching all places if none are found nearby.
 */
export async function fetchNearbyPlaces(options: FetchPlacesOptions): Promise<Place[]> {
  const { location, radiusKm = 50, cuisineType, minHalalLevel, limit = 50 } = options;

  try {
    // Use a Supabase RPC function for geospatial query
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

    if (!error && data && data.length > 0) {
      return data as Place[];
    }
  } catch {
    // RPC failed — fall through to fetchAllPlaces
  }

  // Fallback: fetch all places if nearby query returned nothing or failed
  return fetchAllPlaces(limit);
}

/**
 * Fetch all active places (used as fallback when no nearby places exist).
 */
export async function fetchAllPlaces(limit: number = 50): Promise<Place[]> {
  const { data, error } = await supabase
    .from('places')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data as Place[]) ?? [];
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
    })
    .select()
    .single();

  if (error) throw error;

  // Award points for adding a place
  await supabase.rpc('award_points', { user_id: userId, amount: 50 });

  return data as Place;
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
 */
export async function uploadPhoto(
  uri: string,
  userId: string,
  folder: string = 'places'
): Promise<string> {
  const fileName = `${folder}/${userId}/${Date.now()}.jpg`;
  const response = await fetch(uri);
  const blob = await response.blob();

  const { error } = await supabase.storage.from('photos').upload(fileName, blob, {
    contentType: 'image/jpeg',
    upsert: false,
  });

  if (error) throw error;

  const { data } = supabase.storage.from('photos').getPublicUrl(fileName);
  return data.publicUrl;
}
