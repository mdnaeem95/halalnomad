import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AppColors, borderRadius, typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

interface Props {
  tier: 'highlighted' | 'promoted' | 'spotlight';
}

export function FeaturedBadge({ tier }: Props) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);

  const tierConfig = {
    highlighted: { bg: c.accent + '20', color: c.accent },
    promoted: { bg: c.accent + '30', color: c.accent },
    spotlight: { bg: c.accent, color: c.textOnPrimary },
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

const createStyles = (c: AppColors) => StyleSheet.create({
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
