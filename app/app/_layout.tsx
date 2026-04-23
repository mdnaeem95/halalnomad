import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import * as SplashScreen from 'expo-splash-screen';
import { queryClient, asyncStoragePersister } from '../src/lib/query-client';
import { AuthProvider, useAuth } from '../src/hooks/useAuth';
import { NetworkProvider } from '../src/hooks/useNetwork';
import { useTheme } from '../src/hooks/useTheme';
import { useNotifications } from '../src/hooks/useNotifications';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { OfflineBanner } from '../src/components/OfflineBanner';
import { LoadingSplash } from '../src/components/LoadingSplash';
import { initSentry } from '../src/lib/sentry';
import { initRevenueCat } from '../src/lib/revenue-cat';
import '../src/i18n';

// Hold the native splash until the animated LoadingSplash is mounted,
// so the green-on-green handoff is seamless.
SplashScreen.preventAutoHideAsync().catch(() => {});

initSentry();
initRevenueCat();

function AppStack() {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const { user, isLoading: authLoading } = useAuth();
  useNotifications(user?.id ?? null);

  useEffect(() => {
    // Reveal the animated LoadingSplash as soon as React renders —
    // matching bg colors mean there's no visible flash.
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (authLoading) {
    return <LoadingSplash />;
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
