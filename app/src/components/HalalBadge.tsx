import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HalalLevel, HALAL_LEVEL_LABELS } from '../types';
import { AppColors, borderRadius, typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

interface Props {
  level: HalalLevel;
  compact?: boolean;
}

export function HalalBadge({ level, compact = false }: Props) {
  const { colors: c, halalLevelColors } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);
  const color = halalLevelColors[level];
  const label = HALAL_LEVEL_LABELS[level];

  if (compact) {
    return (
      <View
        style={[styles.compactBadge, { backgroundColor: color }]}
        accessibilityLabel={`Halal level ${level}: ${label}`}
        accessibilityRole="text"
      >
        <Text style={styles.compactText} importantForAccessibility="no">
          {level}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.badge, { backgroundColor: color + '18', borderColor: color }]}
      accessibilityLabel={`Halal verification: ${label}`}
      accessibilityRole="text"
    >
      <View style={[styles.dot, { backgroundColor: color }]} importantForAccessibility="no" />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    ...typography.caption,
    fontWeight: '600',
  },
  compactBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactText: {
    ...typography.caption,
    color: c.textOnPrimary,
    fontWeight: '700',
    fontSize: 11,
  },
});
