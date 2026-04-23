import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { saveUserTimezone, touchLastActive } from '../lib/notifications';

const HEARTBEAT_MIN_INTERVAL_MS = 60 * 60 * 1000; // throttle to once per hour

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : {},
  );

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  return tokenData.data;
}

async function savePushToken(userId: string, token: string) {
  await supabase.from('profiles').update({ push_token: token }).eq('id', userId);
}

function handleNotificationTap(data: Record<string, unknown> | undefined) {
  if (!data) return;
  const placeId = typeof data.placeId === 'string' ? data.placeId : null;
  const screen = typeof data.screen === 'string' ? data.screen : null;
  if (placeId) {
    router.push(`/place/${placeId}`);
  } else if (screen) {
    router.push(screen as never);
  }
}

export function useNotifications(userId: string | null) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const receivedSub = useRef<Notifications.EventSubscription | null>(null);
  const responseSub = useRef<Notifications.EventSubscription | null>(null);
  const lastHeartbeat = useRef<number>(0);

  // Register push token + persist timezone on login
  useEffect(() => {
    registerForPushNotifications().then((token) => {
      if (token) {
        setExpoPushToken(token);
        if (userId) savePushToken(userId, token);
      }
    });

    if (userId) {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz) saveUserTimezone(userId, tz);
      } catch {
        // timezone is optional — silently skip if unavailable
      }
    }
  }, [userId]);

  // Notification listeners — handle foreground + tap-to-open
  useEffect(() => {
    receivedSub.current = Notifications.addNotificationReceivedListener(() => {
      // foreground: the handler above already surfaces the banner
    });

    responseSub.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handleNotificationTap(
          response.notification.request.content.data as
            | Record<string, unknown>
            | undefined,
        );
      },
    );

    // If the app was launched from a notification (cold start), route now.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationTap(
          response.notification.request.content.data as
            | Record<string, unknown>
            | undefined,
        );
      }
    });

    return () => {
      receivedSub.current?.remove();
      responseSub.current?.remove();
    };
  }, []);

  // last_active_at heartbeat — fire on foreground, throttled
  useEffect(() => {
    if (!userId) return;

    const beat = () => {
      const now = Date.now();
      if (now - lastHeartbeat.current < HEARTBEAT_MIN_INTERVAL_MS) return;
      lastHeartbeat.current = now;
      touchLastActive(userId);
    };

    beat(); // immediate on mount/sign-in

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') beat();
    });
    return () => sub.remove();
  }, [userId]);

  return { expoPushToken };
}
