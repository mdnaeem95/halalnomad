import { Linking, Platform } from 'react-native';
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

  openDirections(from: LatLng, to: LatLng): void {
    const url = Platform.select({
      ios: `comgooglemaps://?saddr=${from.latitude},${from.longitude}&daddr=${to.latitude},${to.longitude}&directionsmode=transit`,
      android: `google.navigation:q=${to.latitude},${to.longitude}`,
      default: `https://www.google.com/maps/dir/${from.latitude},${from.longitude}/${to.latitude},${to.longitude}`,
    });

    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        // Fallback to web URL
        Linking.openURL(
          `https://www.google.com/maps/dir/${from.latitude},${from.longitude}/${to.latitude},${to.longitude}`
        );
      }
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
