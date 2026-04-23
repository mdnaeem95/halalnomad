import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Place, CUISINE_LABELS, PRICE_LABELS } from '../types';
import { useTheme } from '../hooks/useTheme';
import {
  AppColors,
  borderRadius,
  shadows,
  spacing,
  typography,
} from '../constants/theme';
import { HalalBadge } from './HalalBadge';
import { FeaturedBadge } from './FeaturedBadge';
import { ReportWarning } from './ReportWarning';

interface Props {
  place: Place;
  onPress: (place: Place) => void;
  distance?: string;
}

export function PlaceCard({ place, onPress, distance }: Props) {
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress(place);
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.card, { backgroundColor: c.surface }, pressed && styles.pressed]}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`${place.name_en}${place.name_local ? `, ${place.name_local}` : ''}. ${CUISINE_LABELS[place.cuisine_type]}${place.price_range ? `, ${PRICE_LABELS[place.price_range]}` : ''}. ${place.address_en}`}
      accessibilityHint="Opens place details"
    >
      {place.photos.length > 0 && (
        <Image
          source={{ uri: place.photos[0] }}
          style={styles.image}
          contentFit="cover"
          transition={200}
          placeholder={{ blurhash: 'LGF5]+Yk^6#M@-5c,1J5@[or[Q6.' }}
          accessibilityLabel={`Photo of ${place.name_en}`}
        />
      )}
      <View style={styles.content}>
        {place.is_featured && place.featured_tier && (
          <FeaturedBadge tier={place.featured_tier} />
        )}
        <View style={styles.header}>
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

        <Text style={[styles.address, { color: c.textTertiary }]} numberOfLines={1}>
          {place.address_en}
        </Text>

        <View style={styles.meta}>
          <Text style={[styles.cuisine, { color: c.primaryLight }]}>
            {CUISINE_LABELS[place.cuisine_type]}
          </Text>
          {place.price_range && (
            <Text style={styles.price}>{PRICE_LABELS[place.price_range]}</Text>
          )}
          {distance && (
            <View style={styles.distanceRow}>
              <Ionicons name="location-outline" size={11} color={c.textTertiary} />
              <Text style={[styles.distance, { color: c.textTertiary }]}>{distance}</Text>
            </View>
          )}
        </View>

        <ReportWarning
          closedReports={place.closed_reports}
          notHalalReports={place.not_halal_reports}
          verificationCount={place.verification_count}
          compact
        />
      </View>
    </Pressable>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  card: {
    backgroundColor: c.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.md,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  pressed: {
    opacity: 0.95,
    transform: [{ scale: 0.98 }],
  },
  image: {
    width: '100%',
    height: 140,
    backgroundColor: c.border,
  },
  content: {
    padding: spacing.md,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    ...typography.h3,
    color: c.textPrimary,
    flex: 1,
  },
  localName: {
    ...typography.bodySmall,
    color: c.textSecondary,
  },
  address: {
    ...typography.bodySmall,
    color: c.textTertiary,
    marginTop: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  cuisine: {
    ...typography.caption,
    color: c.primaryLight,
    fontWeight: '600',
  },
  price: {
    ...typography.caption,
    color: c.textSecondary,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  distance: {
    ...typography.caption,
    color: c.textTertiary,
  },
});
