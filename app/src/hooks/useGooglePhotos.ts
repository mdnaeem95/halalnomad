// Query layer for the display-time Google Place Photos feature.
//
// Every key here starts with googlePhotoKeys.all[0] ('google-photos') —
// _layout.tsx excludes that prefix from the AsyncStorage persister
// (shouldDehydrateQuery), so this data lives in memory for the session
// only. That's a Google ToS requirement (no caching/storing Places
// content), not an optimisation. Photo names and media URIs also
// expire, so persisting them would break rendering anyway.

import { useQuery } from '@tanstack/react-query';
import {
  fetchGooglePhotos,
  fetchGooglePhotoUri,
  GooglePhoto,
} from '../services/google-photos';
import { Place, PlaceSource } from '../types';

export const googlePhotoKeys = {
  all: ['google-photos'] as const,
  meta: (googlePlaceId: string) => ['google-photos', 'meta', googlePlaceId] as const,
  media: (photoName: string, maxWidthPx: number) =>
    ['google-photos', 'media', photoName, maxWidthPx] as const,
};

export function googlePlaceIdFromSources(
  sources: PlaceSource[] | null | undefined
): string | null {
  const google = (sources ?? []).find(
    (s) => s.source === 'google_places' && !!s.source_id
  );
  return google?.source_id ?? null;
}

// Photo metadata (names + author attributions) for a place with no
// community photos. Bills as Place Details IDs Only ($0). Disabled when
// community photos exist — they always win and the Google layer never
// fetches. staleTime Infinity + no focus/reconnect refetch: one fetch
// per place per session, offline pauses rather than errors.
export function useGooglePhotoMeta(place: Place | null | undefined) {
  const googlePlaceId = place ? googlePlaceIdFromSources(place.sources) : null;
  const hasCommunityPhotos = !!place && (place.photos?.length ?? 0) > 0;

  return useQuery<GooglePhoto[]>({
    queryKey: googlePhotoKeys.meta(googlePlaceId ?? 'none'),
    queryFn: () => fetchGooglePhotos(googlePlaceId!),
    enabled: !!googlePlaceId && !hasCommunityPhotos,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

// One billable media request per (photo, size). The enabled flag is the
// quota gate: hero passes true on render, thumbnails only after the
// user expands the gallery — never speculative.
export function useGooglePhotoUri(
  photoName: string | null,
  maxWidthPx: number,
  enabled: boolean
) {
  return useQuery<string>({
    queryKey: googlePhotoKeys.media(photoName ?? 'none', maxWidthPx),
    queryFn: () => fetchGooglePhotoUri(photoName!, maxWidthPx),
    enabled: enabled && !!photoName,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
