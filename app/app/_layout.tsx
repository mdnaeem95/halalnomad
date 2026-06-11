import React, { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as SplashScreen from 'expo-splash-screen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { queryClient, asyncStoragePersister } from '../src/lib/query-client';
import { AuthProvider, useAuth } from '../src/hooks/useAuth';
import { NetworkProvider } from '../src/hooks/useNetwork';
import { useTheme } from '../src/hooks/useTheme';
import { useNotifications } from '../src/hooks/useNotifications';
import { useSessionTracking } from '../src/hooks/useSessionTracking';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { LoadingSplash } from '../src/components/LoadingSplash';
import { Onboarding } from '../src/components/Onboarding';
import { initSentry } from '../src/lib/sentry';
import { initRevenueCat } from '../src/lib/revenue-cat';
import '../src/i18n';

// Bumping the suffix forces existing users through onboarding again
// (e.g. when the disclaimer wording materially changes).
const ONBOARDING_FLAG_KEY = 'onboarding_completed_v1';

// Hold the native splash until the animated LoadingSplash is mounted,
// so the green-on-green handoff is seamless.
SplashScreen.preventAutoHideAsync().catch(() => {});

initSentry();
initRevenueCat();

// First-install boot can stack: expo-updates manifest check, JS cold
// start on cheap Android, AsyncStorage cold init, Supabase session
// restore. Even if each is sub-second, together they sum to "feels
// stuck on the splash." Cap how long we'll block on auth before we
// just render the app — once auth resolves (likely as null = logged
// out for fresh installs), the user state hydrates reactively.
const AUTH_BOOT_TIMEOUT_MS = 8000;

function AppStack() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { user, profile, isLoading: authLoading } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [authBootExpired, setAuthBootExpired] = useState(false);
  useNotifications(user?.id ?? null);
  useSessionTracking(user?.id ?? null, profile);

  useEffect(() => {
    // Reveal the animated LoadingSplash as soon as React renders —
    // matching bg colors mean there's no visible flash.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_FLAG_KEY)
      .then((v) => setOnboardingDone(v === 'true'))
      .catch(() => setOnboardingDone(true)); // fail open — never block on storage
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setAuthBootExpired(true), AUTH_BOOT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, []);

  async function handleOnboardingComplete() {
    setOnboardingDone(true);
    try {
      await AsyncStorage.setItem(ONBOARDING_FLAG_KEY, 'true');
    } catch {
      // Persistence failed — they'll see onboarding again next launch.
      // Acceptable; not blocking.
    }
  }

  // Block on the splash while auth + onboarding resolve, but never past
  // AUTH_BOOT_TIMEOUT_MS. Onboarding flag uses AsyncStorage which has a
  // .catch fail-open in place — if it's still null past the timeout
  // we treat it as "show onboarding" (first launch). Auth still
  // resolves async after the timeout fires; the app re-renders when it
  // does.
  if ((authLoading || onboardingDone === null) && !authBootExpired) {
    return <LoadingSplash />;
  }

  const effectiveOnboardingDone = onboardingDone ?? false;

  if (!effectiveOnboardingDone) {
    return (
      <>
        <StatusBar style="light" />
        <Onboarding onComplete={handleOnboardingComplete} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <OfflineBanner />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.textOnPrimary,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="place/[id]"
          options={{
            title: '',
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
        <Stack.Screen
          name="city/[city]"
          options={{
            title: '',
            headerBackButtonDisplayMode: 'minimal',
          }}
        />
        <Stack.Screen
          name="auth"
          options={{
            title: t('common.signIn'),
            presentation: 'modal',
            headerStyle: { backgroundColor: isDark ? colors.surface : colors.primary },
          }}
        />
        <Stack.Screen
          name="paywall"
          options={{
            title: 'Premium',
            presentation: 'modal',
            headerStyle: { backgroundColor: isDark ? colors.surface : colors.primary },
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: asyncStoragePersister }}
    >
      <NetworkProvider>
        <AuthProvider>
          <ErrorBoundary>
            <AppStack />
          </ErrorBoundary>
        </AuthProvider>
      </NetworkProvider>
    </PersistQueryClientProvider>
  );
}
