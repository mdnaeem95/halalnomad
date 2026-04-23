import {
  wgs84ToGcj02,
  gcj02ToWgs84,
  gcj02ToBd09,
  bd09ToGcj02,
  wgs84ToBd09,
  bd09ToWgs84,
} from '../services/map/coord-convert';

describe('coordinate conversion', () => {
  // Beijing coordinates for testing
  const BEIJING_WGS84 = { lat: 39.9042, lng: 116.4074 };

  describe('wgs84ToGcj02', () => {
    it('applies offset for coordinates inside China', () => {
      const result = wgs84ToGcj02(BEIJING_WGS84.lat, BEIJING_WGS84.lng);
      // GCJ-02 should be offset from WGS-84
      expect(result.latitude).not.toBe(BEIJING_WGS84.lat);
      expect(result.longitude).not.toBe(BEIJING_WGS84.lng);
      // Offset should be small (less than 0.01 degrees ≈ 1km)
      expect(Math.abs(result.latitude - BEIJING_WGS84.lat)).toBeLessThan(0.01);
      expect(Math.abs(result.longitude - BEIJING_WGS84.lng)).toBeLessThan(0.01);
    });

    it('returns unchanged coordinates outside China', () => {
      // London
      const result = wgs84ToGcj02(51.5074, -0.1278);
      expect(result.latitude).toBe(51.5074);
      expect(result.longitude).toBe(-0.1278);
    });
  });

  describe('gcj02ToWgs84', () => {
    it('approximately reverses wgs84ToGcj02', () => {
      const gcj = wgs84ToGcj02(BEIJING_WGS84.lat, BEIJING_WGS84.lng);
      const reversed = gcj02ToWgs84(gcj.latitude, gcj.longitude);
      // Approximate inverse — within ~5m accuracy
      expect(Math.abs(reversed.latitude - BEIJING_WGS84.lat)).toBeLessThan(0.0001);
      expect(Math.abs(reversed.longitude - BEIJING_WGS84.lng)).toBeLessThan(0.0001);
    });
  });

  describe('gcj02ToBd09', () => {
    it('applies BD-09 offset on top of GCJ-02', () => {
      const gcj = wgs84ToGcj02(BEIJING_WGS84.lat, BEIJING_WGS84.lng);
      const bd = gcj02ToBd09(gcj.latitude, gcj.longitude);
      // BD-09 adds another offset
      expect(bd.latitude).not.toBe(gcj.latitude);
      expect(bd.longitude).not.toBe(gcj.longitude);
    });
  });

  describe('bd09ToGcj02', () => {
    it('reverses gcj02ToBd09', () => {
      const gcj = wgs84ToGcj02(BEIJING_WGS84.lat, BEIJING_WGS84.lng);
      const bd = gcj02ToBd09(gcj.latitude, gcj.longitude);
      const reversed = bd09ToGcj02(bd.latitude, bd.longitude);
      expect(Math.abs(reversed.latitude - gcj.latitude)).toBeLessThan(0.0001);
      expect(Math.abs(reversed.longitude - gcj.longitude)).toBeLessThan(0.0001);
    });
  });

  describe('wgs84ToBd09 / bd09ToWgs84 roundtrip', () => {
    it('roundtrips accurately', () => {
      const bd = wgs84ToBd09(BEIJING_WGS84.lat, BEIJING_WGS84.lng);
      const reversed = bd09ToWgs84(bd.latitude, bd.longitude);
      expect(Math.abs(reversed.latitude - BEIJING_WGS84.lat)).toBeLessThan(0.001);
      expect(Math.abs(reversed.longitude - BEIJING_WGS84.lng)).toBeLessThan(0.001);
    });
  });
});
