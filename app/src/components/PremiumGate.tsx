import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { usePremium } from '../hooks/usePremium';
import { useTheme } from '../hooks/useTheme';
import { borderRadius, spacing, typography } from '../constants/theme';

interface Props {
  children: React.ReactNode;
  /** What to show when locked — defaults to a lock overlay */
  fallback?: React.ReactNode;
}

/**
 * Wraps premium-only content.
 * If the user is premium, renders children normally.
 * If not, shows a lock overlay that opens the paywall on tap.
 */
export function PremiumGate({ children, fallback }: Props) {
  const { isPremium } = usePremium();

  if (isPremium) return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  return <PremiumLockBanner />;
}

/**
 * Inline banner that prompts upgrade. Use where a feature is visible but locked.
 */
export function PremiumLockBanner({ message }: { message?: string }) {
  const { colors: c } = useTheme();

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/paywall');
  }

  return (
    <Pressable
      style={[styles.banner, { backgroundColor: c.accent + '12', borderColor: c.accent + '30' }]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Upgrade to HalalNomad Premium"
    >
      <Ionicons name="lock-closed" size={16} color={c.accent} />
      <View style={styles.bannerText}>
        <Text style={[styles.bannerTitle, { color: c.textPrimary }]}>
          {message ?? 'Premium Feature'}
        </Text>
        <Text style={[styles.bannerDesc, { color: c.textSecondary }]}>
          Upgrade to unlock
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.accent} />
    </Pressable>
  );
}

/**
 * Hook to check premium and redirect to paywall if not.
 * Returns true if premium, false if redirected.
 */
export function usePremiumGuard(): { isPremium: boolean; requirePremium: () => boolean } {
  const { isPremium } = usePremium();

  function requirePremium(): boolean {
    if (isPremium) return true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    router.push('/paywall');
    return false;
  }

  return { isPremium, requirePremium };
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  bannerText: {
    flex: 1,
    gap: 1,
  },
  bannerTitle: {
    ...typography.label,
    fontSize: 13,
  },
  bannerDesc: {
    ...typography.caption,
  },
});
