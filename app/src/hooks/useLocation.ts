import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { LatLng, Region } from '../types';
import { track, EVENTS } from '../lib/analytics';

// Module-scoped: useLocation is mounted on multiple screens, but the
// permission state is per-app-session. Track grant/deny exactly once.
let permissionTracked = false;

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
        track(
          status === 'granted'
            ? EVENTS.PERMISSION_LOCATION_GRANTED
            : EVENTS.PERMISSION_LOCATION_DENIED,
        );
        permissionTracked = true;
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
