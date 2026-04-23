import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ContributorTier, TIER_LABELS } from '../types';
import { borderRadius, typography } from '../constants/theme';

const TIER_COLORS: Record<ContributorTier, { bg: string; text: string }> = {
  explorer: { bg: '#E0E0E0', text: '#555555' },
  guide: { bg: '#C8E6C9', text: '#1B5E20' },
  ambassador: { bg: '#FFF8E1', text: '#E65100' },
  legend: { bg: '#FFF3E0', text: '#BF360C' },
};

interface Props {
  tier: ContributorTier;
}

export function TierBadge({ tier }: Props) {
  const tierColors = TIER_COLORS[tier];

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
