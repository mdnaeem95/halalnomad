import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import {
  borderRadius,
  colors,
  shadows,
  spacing,
} from '../constants/theme';

/**
 * Animated shimmer block using plain RN Animated API.
 */
function ShimmerBlock({ width, height, radius = borderRadius.sm }: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
}) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: colors.border,
        opacity,
      }}
    />
  );
}

export function PlaceCardSkeleton() {
  return (
    <View style={s.card}>
      <ShimmerBlock width="100%" height={140} radius={0} />
      <View style={s.content}>
        <View style={s.row}>
          <ShimmerBlock width="65%" height={18} />
          <ShimmerBlock width={22} height={22} radius={11} />
        </View>
        <ShimmerBlock width="40%" height={14} />
        <ShimmerBlock width="80%" height={14} />
        <View style={s.row}>
          <ShimmerBlock width={80} height={12} />
          <ShimmerBlock width={30} height={12} />
        </View>
      </View>
    </View>
  );
}

export function PlaceListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={s.list}>
      {Array.from({ length: count }).map((_, i) => (
        <PlaceCardSkeleton key={i} />
      ))}
    </View>
  );
}

export function PlaceDetailSkeleton() {
  return (
    <View style={s.detail}>
      <ShimmerBlock width="100%" height={220} radius={0} />
      <View style={s.detailContent}>
        <ShimmerBlock width="75%" height={24} />
        <ShimmerBlock width="50%" height={18} />
        <ShimmerBlock width={120} height={28} radius={14} />
        <View style={s.detailCard}>
          <ShimmerBlock width="30%" height={12} />
          <ShimmerBlock width="90%" height={16} />
          <View style={{ height: 12 }} />
          <ShimmerBlock width="25%" height={12} />
          <ShimmerBlock width="60%" height={16} />
        </View>
        <ShimmerBlock width="100%" height={48} radius={borderRadius.md} />
        <ShimmerBlock width="100%" height={48} radius={borderRadius.md} />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  content: { padding: spacing.md, gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  list: { paddingTop: spacing.sm },
  detail: { flex: 1, backgroundColor: colors.background },
  detailContent: { padding: spacing.md, gap: 10 },
  detailCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: 8,
    ...shadows.sm,
  },
});
