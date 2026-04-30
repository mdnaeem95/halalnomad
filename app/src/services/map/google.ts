import { Linking } from 'react-native';
import { LatLng } from '../../types';
import { MapAddress, MapProvider, MapSearchResult } from './types';

/**
 * Google Maps provider — default for most of the world.
 * Uses WGS-84 coordinates natively, so no conversion needed.
 */
export const GoogleMapsProvider: MapProvider = {
  name: 'google',
  label: 'Google Maps',
  regions: ['global'],

  async search(_query: string, _location: LatLng): Promise<MapSearchResult[]> {
    // In production, this would call the Google Places API.
    // For now, return empty — places come from our own Supabase database.
    return [];
  },

  async reverseGeocode(location: LatLng): Promise<MapAddress> {
    // In production, call the Google Geocoding API.
    return {
      formatted: `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`,
      street: null,
      city: null,
      country: null,
    };
  },

  openDirections(from: LatLng | null | undefined, to: LatLng): void {
    // Use Google Maps universal HTTPS URL — works without any scheme
    // declaration in Info.plist (LSApplicationQueriesSchemes). On iOS,
    // if the Google Maps app is installed it auto-handles this URL;
    // otherwise it opens in Safari → Google Maps web. Either way, the
    // user gets directions. If `from` is provided we pass it as origin;
    // otherwise the maps app figures it out from current location.
    const dest = `${to.latitude},${to.longitude}`;
    const url = from
      ? `https://www.google.com/maps/dir/?api=1&origin=${from.latitude},${from.longitude}&destination=${dest}`
      : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;

    Linking.openURL(url).catch(() => {
      // Last-resort fallback (should never hit in practice — HTTPS URLs
      // always open). Try the Apple Maps universal URL.
      Linking.openURL(`https://maps.apple.com/?daddr=${dest}`);
    });
  },

  toWGS84(lat: number, lng: number): LatLng {
    // Google Maps already uses WGS-84
    return { latitude: lat, longitude: lng };
  },

  fromWGS84(lat: number, lng: number): LatLng {
    return { latitude: lat, longitude: lng };
  },
};
