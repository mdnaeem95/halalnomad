import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { borderRadius, colors, typography } from '../constants/theme';

interface Props {
  tier: 'highlighted' | 'promoted' | 'spotlight';
}

export function FeaturedBadge({ tier }: Props) {
  const { t } = useTranslation();

  const tierConfig = {
    highlighted: { bg: colors.accent + '20', color: colors.accent },
    promoted: { bg: colors.accent + '30', color: colors.accent },
    spotlight: { bg: colors.accent, color: colors.white },
  };

  const config = tierConfig[tier];

  return (
    <View
      style={[styles.badge, { backgroundColor: config.bg }]}
      accessibilityLabel={t('featured.badge')}
      accessibilityRole="text"
    >
      <Ionicons name="star" size={10} color={config.color} />
      <Text style={[styles.text, { color: config.color }]}>
        {t('featured.badge')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
