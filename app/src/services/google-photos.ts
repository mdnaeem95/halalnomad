// Display-time Google Place Photos for zero-photo places.
//
// ToS constraint that shapes everything here: Places content must NOT be
// pre-fetched, cached, or stored (only the place_id is exempt). Photo
// names expire and the media photoUri is short-lived, so nothing from
// these calls may ever reach Supabase, AsyncStorage, or the query
// persister — the query keys in useGooglePhotos are excluded from
// dehydration in _layout.tsx. If you add a call here that persists a
// photo byte or URI, that's a bug.
//
// Billing (verified 2026-07-17): the metadata call uses FieldMask
// 'id,photos' which bills as Place Details Essentials (IDs Only) —
// $0.00, unlimited. Each media request bills the "Place Details Photos"
// SKU (~$7/1,000 after 1,000 free/month) and is quota-capped per-day in
// Cloud Console, so every media fetch must be user-initiated (render or
// tap), never speculative.

import { captureError } from '../lib/sentry';

const PLACES_API_BASE = 'https://places.googleapis.com/v1';
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

// Hero + up to 2 thumbnails — never consider more, so a single place
// view can cost at most 3 media requests (and only 1 without a tap).
export const MAX_GOOGLE_PHOTOS = 3;

// Images render at 320×220pt (@3x → 960px). Same request size for hero
// and thumbnails so a photo shown in both roles shares one query key.
export const GOOGLE_PHOTO_WIDTH_PX = 960;

export interface GooglePhotoAuthor {
  displayName: string;
  // Author's Google Maps profile — attribution policy wants the credit
  // to link back when we show the full-size treatment.
  uri: string | null;
  // Author avatar image — the policy minimum for thumbnail contexts.
  avatarUri: string | null;
}

export interface GooglePhoto {
  // Resource name ("places/{place_id}/photos/{ref}") — expires; never store.
  name: string;
  widthPx: number;
  heightPx: number;
  authors: GooglePhotoAuthor[];
}

interface RawPhotosResponse {
  photos?: {
    name?: string;
    widthPx?: number;
    heightPx?: number;
    authorAttributions?: {
      displayName?: string;
      uri?: string;
      photoUri?: string;
    }[];
  }[];
}

// Failure semantics matter here: a REJECTED response (429 from the
// quota cap, 404 from a stale place_id, network drop) THROWS so the
// query lands in error state and refetches on the next visit to the
// place. Returning a soft empty result instead would be cached as
// success (staleTime: Infinity) and pin "no photos" for the whole
// session on a transient blip. The UI still never shows an error —
// error state renders as the normal no-photo layout.
export async function fetchGooglePhotos(placeId: string): Promise<GooglePhoto[]> {
  // No key / no id is a permanent condition, not a transient failure —
  // cache it as a real empty result.
  if (!API_KEY || !placeId) return [];
  const response = await fetch(`${PLACES_API_BASE}/places/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': API_KEY,
      'X-Goog-FieldMask': 'id,photos',
    },
  });
  if (!response.ok) {
    const err = new Error(`google photos metadata: HTTP ${response.status}`);
    // HTTP-level failures are worth eyes (quota, key restrictions, API
    // changes); pure network throws stay uncaptured — transient noise.
    captureError(err, { feature: 'google_photos', status: String(response.status) });
    throw err;
  }
  const data = (await response.json()) as RawPhotosResponse;
  return (data.photos ?? [])
      .filter((p) => p.name)
      .slice(0, MAX_GOOGLE_PHOTOS)
      .map((p) => ({
        name: p.name!,
        widthPx: p.widthPx ?? 0,
        heightPx: p.heightPx ?? 0,
        authors: (p.authorAttributions ?? [])
          .filter((a) => a.displayName)
          .map((a) => ({
            displayName: a.displayName!,
            uri: a.uri ?? null,
            avatarUri: a.photoUri ?? null,
          })),
      }));
}

// One billable media request. skipHttpRedirect gives us the short-lived
// googleusercontent URI as JSON, so the image itself is then loaded by
// expo-image without our API key attached to the request.
//
// Throws on every failure (same reasoning as fetchGooglePhotos): a 429
// from the per-minute quota must land as query error state — retried on
// the next mount — not get pinned as a session-long "no photo".
export async function fetchGooglePhotoUri(
  photoName: string,
  maxWidthPx: number
): Promise<string> {
  if (!API_KEY || !photoName) throw new Error('google photo media: missing key or name');
  const response = await fetch(
    `${PLACES_API_BASE}/${photoName}/media?maxWidthPx=${maxWidthPx}&skipHttpRedirect=true`,
    { headers: { 'X-Goog-Api-Key': API_KEY } }
  );
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    const err = new Error(`google photo media: HTTP ${response.status} ${body.slice(0, 160)}`);
    captureError(err, { feature: 'google_photos', status: String(response.status) });
    throw err;
  }
  const data = (await response.json()) as { photoUri?: string };
  if (!data.photoUri) throw new Error('google photo media: missing photoUri');
  return data.photoUri;
}
