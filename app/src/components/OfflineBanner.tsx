import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNetwork } from '../hooks/useNetwork';
import { colors, spacing, typography } from '../constants/theme';

/**
 * Persistent banner at the top of the app when offline.
 * Slides down when offline, slides up when reconnected.
 */
export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetwork();
  const insets = useSafeAreaInsets();
  const isOffline = !isConnected || !isInternetReachable;
  const bannerHeight = insets.top + 40;
  const translateY = useRef(new Animated.Value(-bannerHeight)).current;

  useEffect(() => {
    Animated.spring(translateY, {
      toValue: isOffline ? 0 : -bannerHeight,
      tension: 60,
      friction: 10,
      useNativeDriver: true,
    }).start();
  }, [isOffline, bannerHeight]);

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          paddingTop: insets.top + spacing.xs,
          transform: [{ translateY }],
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      accessibilityLabel="You are offline. Showing cached data."
    >
      <Ionicons name="cloud-offline-outline" size={16} color={colors.white} />
      <Text style={styles.text}>
        You're offline. Showing cached data.
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.textSecondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
    zIndex: 9999,
  },
  text: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
});
