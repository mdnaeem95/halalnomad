import { LatLng } from '../../types';

export interface MapAddress {
  formatted: string;
  street: string | null;
  city: string | null;
  country: string | null;
}

export interface MapSearchResult {
  id: string;
  name: string;
  address: string;
  location: LatLng;
}

export interface MapProvider {
  /** Provider identifier */
  name: string;

  /** Human-readable label */
  label: string;

  /** Regions where this provider is recommended (ISO 3166-1 alpha-2 codes, or 'global') */
  regions: string[];

  /** Search for places by text query near a location */
  search(query: string, location: LatLng): Promise<MapSearchResult[]>;

  /** Reverse geocode a coordinate into an address */
  reverseGeocode(location: LatLng): Promise<MapAddress>;

  /** Open directions in the native map app */
  openDirections(from: LatLng, to: LatLng): void;

  /** Convert provider-specific coordinates to WGS-84 */
  toWGS84(lat: number, lng: number): LatLng;

  /** Convert WGS-84 coordinates to provider-specific format */
  fromWGS84(lat: number, lng: number): LatLng;
}
