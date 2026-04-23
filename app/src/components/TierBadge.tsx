import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ContributorTier, TIER_LABELS } from '../types';
import { borderRadius, typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

const TIER_COLORS_LIGHT: Record<ContributorTier, { bg: string; text: string }> = {
  explorer: { bg: '#E0E0E0', text: '#424242' },
  guide: { bg: '#C8E6C9', text: '#1B5E20' },
  ambassador: { bg: '#FFF8E1', text: '#E65100' },
  legend: { bg: '#FFF3E0', text: '#BF360C' },
};

const TIER_COLORS_DARK: Record<ContributorTier, { bg: string; text: string }> = {
  explorer: { bg: '#3A3A3A', text: '#E0E0E0' },
  guide: { bg: '#1B5E20', text: '#C8E6C9' },
  ambassador: { bg: '#5D4037', text: '#FFE082' },
  legend: { bg: '#6A1B1B', text: '#FFCCBC' },
};

interface Props {
  tier: ContributorTier;
}

export function TierBadge({ tier }: Props) {
  const { isDark } = useTheme();
  const tierColors = (isDark ? TIER_COLORS_DARK : TIER_COLORS_LIGHT)[tier];

  return (
    <View
      style={[styles.badge, { backgroundColor: tierColors.bg }]}
      accessibilityLabel={`Contributor tier: ${TIER_LABELS[tier]}`}
      accessibilityRole="text"
    >
      <Text style={[styles.label, { color: tierColors.text }]}>
        {TIER_LABELS[tier]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
  },
});
