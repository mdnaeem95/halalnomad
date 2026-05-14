import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '../constants/theme';

const SPLASH_BG = '#1B5E20';

/**
 * Animated splash screen that matches the native splash background (#1B5E20)
 * so there's no visible transition when Expo hands off from its splash to us.
 *
 * Used both at app boot (while auth is resolving) and on the Explore tab
 * while location resolves.
 *
 * If no explicit `message` is passed, the bottom row cycles through
 * progressive hints — by 5s "Setting things up", by 12s "Almost there"
 * — so first-install users with slow networks see the app working
 * rather than feeling frozen on a static splash.
 */
const PROGRESS_STEPS = [
  { at: 0, text: 'Getting ready' },
  { at: 5000, text: 'Setting things up' },
  { at: 12000, text: 'Almost there' },
];

export function LoadingSplash({ message }: { message?: string } = {}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;
  const [progressIndex, setProgressIndex] = useState(0);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200,
      delay: 400,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0.4, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Progressive messaging — only when no explicit message was passed.
  // Cleared on unmount so we don't update state after teardown.
  useEffect(() => {
    if (message) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    PROGRESS_STEPS.forEach((step, i) => {
      if (step.at === 0) return;
      timers.push(setTimeout(() => setProgressIndex(i), step.at));
    });
    return () => timers.forEach(clearTimeout);
  }, [message]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
        <View style={styles.iconCircle}>
          <Ionicons name="compass" size={48} color={SPLASH_BG} />
        </View>
      </Animated.View>

      <Text style={styles.title}>HalalNomad</Text>

      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.tagline}>Halal food, anywhere in the world</Text>
      </Animated.View>

      <Animated.View style={[styles.loadingRow, { opacity: dotAnim }]}>
        <Ionicons name="location" size={14} color="rgba(255,255,255,0.8)" />
        <Text style={styles.loadingText}>
          {message ?? PROGRESS_STEPS[progressIndex].text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SPLASH_BG,
    padding: spacing.xl,
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    ...typography.h1,
    color: '#FFFFFF',
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  tagline: {
    ...typography.body,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.bodySmall,
    color: 'rgba(255,255,255,0.8)',
  },
});
