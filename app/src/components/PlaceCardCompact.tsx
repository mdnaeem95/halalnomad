import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Place, CUISINE_LABELS, PRICE_LABELS } from '../types';
import { useTheme } from '../hooks/useTheme';
import { HalalBadge } from './HalalBadge';
import {
  borderRadius,
  colors,
  shadows,
  spacing,
  typography,
} from '../constants/theme';

interface Props {
  place: Place & { distanceLabel?: string };
  onPress: (place: Place) => void;
  width: number;
}

/**
 * Compact horizontal card for the map carousel.
 * Shows key info at a glance — name, local name, cuisine, price, halal level.
 */
export function PlaceCardCompact({ place, onPress, width }: Props) {
  const { colors: c } = useTheme();

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(place);
  }

  return (
    <Pressable
      style={[styles.card, { width, backgroundColor: c.surface }]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${place.name_en}. ${CUISINE_LABELS[place.cuisine_type]}`}
    >
      {place.photos.length > 0 ? (
        <Image
          source={{ uri: place.photos[0] }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder]}>
          <Ionicons name="restaurant-outline" size={24} color={c.textTertiary} />
        </View>
      )}
      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: c.textPrimary }]} numberOfLines={1}>
            {place.name_en}
          </Text>
          <HalalBadge level={place.halal_level} compact />
        </View>
        {place.name_local && (
          <Text style={[styles.localName, { color: c.textSecondary }]} numberOfLines={1}>
            {place.name_local}
          </Text>
        )}
        <View style={styles.meta}>
          <Text style={[styles.cuisine, { color: c.primaryLight }]}>
            {CUISINE_LABELS[place.cuisine_type]}
          </Text>
          {place.price_range && (
            <Text style={[styles.price, { color: c.textTertiary }]}>
              {PRICE_LABELS[place.price_range]}
            </Text>
          )}
        </View>
        <View style={styles.bottomRow}>
          {place.distanceLabel && (
            <>
              <Ionicons name="location-outline" size={12} color={c.textTertiary} />
              <Text style={[styles.distanceText, { color: c.textTertiary }]}>
                {place.distanceLabel}
              </Text>
              <Text style={[styles.dot, { color: c.textTertiary }]}>·</Text>
            </>
          )}
          <Ionicons name="chevron-forward" size={12} color={c.primary} />
          <Text style={[styles.tapHint, { color: c.primary }]}>Details</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    flexDirection: 'row',
    height: 120,
    ...shadows.lg,
  },
  image: {
    width: 100,
    height: '100%',
    backgroundColor: colors.border,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.sm,
    paddingStart: spacing.md,
    justifyContent: 'center',
    gap: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    ...typography.label,
    fontSize: 15,
    flex: 1,
  },
  localName: {
    ...typography.caption,
    fontSize: 13,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  cuisine: {
    ...typography.caption,
    fontWeight: '600',
  },
  price: {
    ...typography.caption,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  distanceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  dot: {
    fontSize: 11,
  },
  tapHint: {
    fontSize: 11,
    fontWeight: '600',
  },
});
