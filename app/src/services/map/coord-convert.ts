import { LatLng } from '../../types';

/**
 * Coordinate conversion utilities for China's GCJ-02 and Baidu's BD-09 systems.
 *
 * China mandates a coordinate obfuscation system (GCJ-02, aka "Mars coordinates")
 * that shifts WGS-84 GPS coordinates by varying offsets. Baidu adds another layer
 * on top (BD-09). These conversions are needed for AMap and Baidu Maps to display
 * markers at the correct positions.
 *
 * Reference: https://en.wikipedia.org/wiki/Restrictions_on_geographic_data_in_China
 */

const PI = Math.PI;
const A = 6378245.0; // Semi-major axis of Krasovsky ellipsoid
const EE = 0.006693421622965943; // Eccentricity squared

function isInChina(lat: number, lng: number): boolean {
  return lng > 73.66 && lng < 135.05 && lat > 3.86 && lat < 53.55;
}

function transformLat(x: number, y: number): number {
  let ret =
    -100.0 +
    2.0 * x +
    3.0 * y +
    0.2 * y * y +
    0.1 * x * y +
    0.2 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((160.0 * Math.sin((y / 12.0) * PI) + 320 * Math.sin((y * PI) / 30.0)) * 2.0) / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret =
    300.0 +
    x +
    2.0 * y +
    0.1 * x * x +
    0.1 * x * y +
    0.1 * Math.sqrt(Math.abs(x));
  ret += ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0) / 3.0;
  ret += ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) / 3.0;
  ret += ((150.0 * Math.sin((x / 12.0) * PI) + 300.0 * Math.sin((x / 30.0) * PI)) * 2.0) / 3.0;
  return ret;
}

/** WGS-84 → GCJ-02 (used by AMap/Gaode) */
export function wgs84ToGcj02(lat: number, lng: number): LatLng {
  if (!isInChina(lat, lng)) {
    return { latitude: lat, longitude: lng };
  }

  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = (lat / 180.0) * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / (((A * (1 - EE)) / (magic * sqrtMagic)) * PI);
  dLng = (dLng * 180.0) / ((A / sqrtMagic) * Math.cos(radLat) * PI);

  return {
    latitude: lat + dLat,
    longitude: lng + dLng,
  };
}

/** GCJ-02 → WGS-84 (approximate inverse) */
export function gcj02ToWgs84(lat: number, lng: number): LatLng {
  if (!isInChina(lat, lng)) {
    return { latitude: lat, longitude: lng };
  }

  const gcj = wgs84ToGcj02(lat, lng);
  return {
    latitude: lat * 2 - gcj.latitude,
    longitude: lng * 2 - gcj.longitude,
  };
}

/** GCJ-02 → BD-09 (used by Baidu Maps) */
export function gcj02ToBd09(lat: number, lng: number): LatLng {
  const z = Math.sqrt(lng * lng + lat * lat) + 0.00002 * Math.sin(lat * PI * 3000.0 / 180.0);
  const theta = Math.atan2(lat, lng) + 0.000003 * Math.cos(lng * PI * 3000.0 / 180.0);
  return {
    latitude: z * Math.sin(theta) + 0.006,
    longitude: z * Math.cos(theta) + 0.0065,
  };
}

/** BD-09 → GCJ-02 */
export function bd09ToGcj02(lat: number, lng: number): LatLng {
  const x = lng - 0.0065;
  const y = lat - 0.006;
  const z = Math.sqrt(x * x + y * y) - 0.00002 * Math.sin(y * PI * 3000.0 / 180.0);
  const theta = Math.atan2(y, x) - 0.000003 * Math.cos(x * PI * 3000.0 / 180.0);
  return {
    latitude: z * Math.sin(theta),
    longitude: z * Math.cos(theta),
  };
}

/** WGS-84 → BD-09 */
export function wgs84ToBd09(lat: number, lng: number): LatLng {
  const gcj = wgs84ToGcj02(lat, lng);
  return gcj02ToBd09(gcj.latitude, gcj.longitude);
}

/** BD-09 → WGS-84 */
export function bd09ToWgs84(lat: number, lng: number): LatLng {
  const gcj = bd09ToGcj02(lat, lng);
  return gcj02ToWgs84(gcj.latitude, gcj.longitude);
}
