import { LatLng } from '../types';

/**
 * Calculate distance between two coordinates using the Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Format a distance for display.
 * Under 1km: "350m"
 * 1-10km: "2.4 km"
 * 10+km: "15 km"
 * 100+km: "150 km"
 */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/**
 * Add distance to each place and sort by distance (nearest first).
 * Featured places stay at the top regardless of distance.
 */
export function sortByDistance<T extends { latitude: number; longitude: number; is_featured: boolean }>(
  places: T[],
  userLocation: LatLng
): (T & { distance: number; distanceLabel: string })[] {
  return places
    .map((place) => {
      const distance = haversineKm(userLocation, {
        latitude: place.latitude,
        longitude: place.longitude,
      });
      return {
        ...place,
        distance,
        distanceLabel: formatDistance(distance),
      };
    })
    .sort((a, b) => {
      // Featured first, then by distance
      if (a.is_featured && !b.is_featured) return -1;
      if (!a.is_featured && b.is_featured) return 1;
      return a.distance - b.distance;
    });
}
