import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import pRetry from 'p-retry';
import {
  fetchNearbyPlaces,
  fetchPlace,
  fetchReviews,
  fetchUserVerifications,
  searchPlaces,
  addPlace as addPlaceApi,
  verifyPlace as verifyPlaceApi,
  addReview as addReviewApi,
  uploadPhoto,
} from '../services/places';
import { captureError } from '../lib/sentry';
import { track, EVENTS } from '../lib/analytics';
import { sortByDistance } from '../lib/distance';
import { recordPositiveAction } from '../lib/store-review';
import { CuisineType, HalalLevel, LatLng, Place, Verification } from '../types';

// ============================================
// QUERY KEYS (centralized for cache invalidation)
// ============================================

export const placeKeys = {
  all: ['places'] as const,
  nearby: (lat: number, lng: number) => ['places', 'nearby', lat, lng] as const,
  detail: (id: string) => ['places', 'detail', id] as const,
  search: (query: string, cuisine?: CuisineType | null) =>
    ['places', 'search', query, cuisine] as const,
  reviews: (placeId: string) => ['places', 'reviews', placeId] as const,
  userVerifications: (placeId: string, userId: string) =>
    ['places', 'user-verifications', placeId, userId] as const,
};

// ============================================
// QUERIES
// ============================================

export function useNearbyPlaces(location: LatLng | null) {
  return useQuery({
    queryKey: placeKeys.nearby(
      location?.latitude ?? 0,
      location?.longitude ?? 0
    ),
    queryFn: async () => {
      const places = await fetchNearbyPlaces({ location: location! });
      return sortByDistance(places, location!);
    },
    enabled: !!location,
  });
}

export type PlaceWithDistance = Place & { distance: number; distanceLabel: string };

export function usePlace(id: string | undefined) {
  return useQuery({
    queryKey: placeKeys.detail(id ?? ''),
    queryFn: () => fetchPlace(id!),
    enabled: !!id,
  });
}

export function useSearchPlaces(query: string, cuisineType?: CuisineType | null) {
  return useQuery({
    queryKey: placeKeys.search(query, cuisineType),
    queryFn: async () => {
      const data = await searchPlaces(query);
      if (cuisineType) {
        return data.filter((p) => p.cuisine_type === cuisineType);
      }
      return data;
    },
    enabled: query.length > 0 || !!cuisineType,
  });
}

export function useReviews(placeId: string) {
  return useQuery({
    queryKey: placeKeys.reviews(placeId),
    queryFn: () => fetchReviews(placeId),
  });
}

/**
 * Returns which verification types the current user has already submitted
 * for this place. Used to disable already-used actions in the UI.
 */
export function useUserVerifications(placeId: string | undefined, userId: string | undefined) {
  const query = useQuery({
    queryKey: placeKeys.userVerifications(placeId ?? '', userId ?? ''),
    queryFn: () => fetchUserVerifications(placeId!, userId!),
    enabled: !!placeId && !!userId,
  });

  const types = query.data ?? [];
  return {
    hasConfirmed: types.includes('confirm'),
    hasFlaggedClosed: types.includes('flag_closed'),
    hasFlaggedNotHalal: types.includes('flag_not_halal'),
    hasUploadedCertificate: types.includes('certificate'),
    isLoading: query.isLoading,
  };
}

// ============================================
// MUTATIONS
// ============================================

export function useAddPlace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      input,
      userId,
      photoUris,
    }: {
      input: Parameters<typeof addPlaceApi>[0];
      userId: string;
      photoUris: string[];
    }) => {
      // Upload photos with retry (network can be flaky for uploads)
      const photoUrls: string[] = [];
      for (const uri of photoUris) {
        const url = await pRetry(() => uploadPhoto(uri, userId), { retries: 2 });
        photoUrls.push(url);
      }
      return pRetry(
        () => addPlaceApi({ ...input, photos: photoUrls }, userId),
        { retries: 2 }
      );
    },
    onSuccess: (_data, { input }) => {
      queryClient.invalidateQueries({ queryKey: placeKeys.all });
      track(EVENTS.PLACE_ADDED, { cuisine: input.cuisine_type });
      recordPositiveAction();
    },
    onError: (error) => {
      captureError(error, { mutation: 'addPlace' });
    },
  });
}

export function useVerifyPlace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      placeId,
      userId,
      type,
      photoUrl,
    }: {
      placeId: string;
      userId: string;
      type: Verification['type'];
      photoUrl?: string;
    }) => pRetry(() => verifyPlaceApi(placeId, userId, type, photoUrl), { retries: 2 }),

    // Optimistic update
    onMutate: async ({ placeId, type }) => {
      // Cancel in-flight queries so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: placeKeys.detail(placeId) });

      const previousPlace = queryClient.getQueryData<Place>(
        placeKeys.detail(placeId)
      );

      if (previousPlace) {
        const updated = { ...previousPlace };

        if (type === 'confirm') {
          updated.verification_count += 1;
          if (updated.verification_count >= 3) {
            updated.halal_level = Math.max(updated.halal_level, 2) as HalalLevel;
          }
        } else if (type === 'flag_closed') {
          updated.closed_reports += 1;
        } else if (type === 'flag_not_halal') {
          updated.not_halal_reports += 1;
        }

        queryClient.setQueryData(placeKeys.detail(placeId), updated);
      }

      return { previousPlace };
    },

    onError: (error, { placeId }, context) => {
      // Revert on failure
      if (context?.previousPlace) {
        queryClient.setQueryData(
          placeKeys.detail(placeId),
          context.previousPlace
        );
      }
      captureError(error, { mutation: 'verifyPlace', placeId });
    },

    onSettled: (_data, _err, { placeId, userId, type }) => {
      queryClient.invalidateQueries({ queryKey: placeKeys.detail(placeId) });
      queryClient.invalidateQueries({ queryKey: placeKeys.all });
      queryClient.invalidateQueries({
        queryKey: placeKeys.userVerifications(placeId, userId),
      });

      if (!_err) {
        if (type === 'confirm') {
          track(EVENTS.PLACE_VERIFIED, { placeId });
          recordPositiveAction();
        } else if (type === 'flag_closed' || type === 'flag_not_halal') {
          track(EVENTS.PLACE_REPORTED, { placeId, reportType: type });
        }
      }
    },
  });
}

export function useAddReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      placeId,
      userId,
      rating,
      text,
    }: {
      placeId: string;
      userId: string;
      rating: number;
      text: string;
    }) => pRetry(() => addReviewApi(placeId, userId, rating, text), { retries: 2 }),

    onError: (error) => {
      captureError(error, { mutation: 'addReview' });
    },

    onSuccess: (_data, { placeId, rating }) => {
      queryClient.invalidateQueries({ queryKey: placeKeys.reviews(placeId) });
      track(EVENTS.REVIEW_ADDED, { placeId, rating });
      recordPositiveAction();
    },
  });
}
