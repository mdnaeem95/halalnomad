import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LatLng, Region } from '../types';
import { track, EVENTS } from '../lib/analytics';

// Module-scoped: useLocation is mounted on multiple screens; only check the
// permission decision once per session.
let permissionTracked = false;

// Fire the grant/deny event only when the DECISION changes, not per session —
// the last-tracked status persists across launches. Before this (M2 Wk2), the
// event re-fired every cold start, so the dashboard's grants tile counted
// sessions (41 grants ≈ 41 opens), not people-decisions.
const PERMISSION_TRACKED_KEY = 'permission_location_last_tracked';

async function trackPermissionChange(status: string): Promise<void> {
  try {
    const prev = await AsyncStorage.getItem(PERMISSION_TRACKED_KEY);
    if (prev === status) return;
    track(
      status === 'granted'
        ? EVENTS.PERMISSION_LOCATION_GRANTED
        : EVENTS.PERMISSION_LOCATION_DENIED,
    );
    await AsyncStorage.setItem(PERMISSION_TRACKED_KEY, status);
  } catch {
    // Storage failure → skip rather than risk re-firing every session.
  }
}

const DEFAULT_LOCATION: LatLng = {
  latitude: 21.4225, // Mecca — fitting default
  longitude: 39.8262,
};

const DEFAULT_REGION: Region = {
  ...DEFAULT_LOCATION,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export function useLocation() {
  const [location, setLocation] = useState<LatLng | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!permissionTracked) {
        permissionTracked = true;
        void trackPermissionChange(status);
      }
      if (status !== 'granted') {
        setErrorMsg('Location permission denied. Showing default location.');
        setIsLoading(false);
        return;
      }

      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        const coords: LatLng = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setLocation(coords);
        setRegion({
          ...coords,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        });
      } catch {
        setErrorMsg('Could not get your location.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return { location, region, setRegion, errorMsg, isLoading };
}
