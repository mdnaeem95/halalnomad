import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../constants/theme';

/**
 * Animated splash screen shown while location is loading.
 * Pulsing compass icon with a fade-in tagline.
 */
export function LoadingSplash() {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dotAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Pulse the icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    // Fade in the tagline
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200,
      delay: 400,
      useNativeDriver: true,
    }).start();

    // Animate the loading dots
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
        <View style={styles.iconCircle}>
          <Ionicons name="compass" size={48} color={colors.white} />
        </View>
      </Animated.View>

      <Text style={styles.title}>HalalNomad</Text>

      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.tagline}>
          Halal food, anywhere in the world
        </Text>
      </Animated.View>

      <Animated.View style={[styles.loadingRow, { opacity: dotAnim }]}>
        <Ionicons name="location" size={14} color={colors.primaryLight} />
        <Text style={styles.loadingText}>Finding your location</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  },
  iconContainer: {
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
    fontSize: 32,
    marginBottom: spacing.sm,
  },
  tagline: {
    ...typography.body,
    color: colors.textSecondary,
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
    color: colors.primaryLight,
  },
});
