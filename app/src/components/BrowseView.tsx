import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useCountriesWithCities } from '../hooks/usePlaces';
import { useTheme } from '../hooks/useTheme';
import { COUNTRY_FLAGS } from '../types';
import { AppColors, borderRadius, spacing, typography } from '../constants/theme';

/**
 * Browse-by-country view for the Explore tab. Renders the global
 * coverage as a country → city tree with place counts. Tap a city to
 * see the places in that city.
 *
 * Acts as social proof ("13 cities, 1,361 places") and as the primary
 * pre-trip planning tool — find out before you fly whether HalalNomad
 * has you covered.
 */
export function BrowseView() {
  const { data: groups, isLoading, error } = useCountriesWithCities();
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);

  function handleCityPress(city: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/city/${encodeURIComponent(city)}`);
  }

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={c.primary} />
      </View>
    );
  }

  if (error || !groups) {
    return (
      <View style={styles.centered}>
        <Text style={[styles.errorText, { color: c.textSecondary }]}>
          Couldn't load coverage. Pull to refresh.
        </Text>
      </View>
    );
  }

  const totalPlaces = groups.reduce((sum, g) => sum + g.total, 0);
  const totalCities = groups.reduce((sum, g) => sum + g.cities.length, 0);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Global summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>Coverage</Text>
        <Text style={styles.summaryStat}>
          <Text style={styles.summaryNumber}>{totalPlaces.toLocaleString()}</Text>
          {' '}verified Halal places
        </Text>
        <Text style={styles.summaryStat}>
          across <Text style={styles.summaryNumber}>{totalCities}</Text>{' '}
          {totalCities === 1 ? 'city' : 'cities'} in{' '}
          <Text style={styles.summaryNumber}>{groups.length}</Text>{' '}
          {groups.length === 1 ? 'country' : 'countries'}
        </Text>
      </View>

      {/* Countries */}
      {groups.map((group) => (
        <View key={group.country} style={styles.countryGroup}>
          <View style={styles.countryHeader}>
            <Text style={styles.countryFlag}>
              {COUNTRY_FLAGS[group.country] ?? '🌍'}
            </Text>
            <Text style={styles.countryName}>{group.country}</Text>
            <Text style={styles.countryTotal}>{group.total}</Text>
          </View>

          {group.cities.map((city) => (
            <Pressable
              key={city.name}
              style={({ pressed }) => [
                styles.cityRow,
                pressed && styles.cityRowPressed,
              ]}
              onPress={() => handleCityPress(city.name)}
              accessibilityRole="button"
              accessibilityLabel={`${city.name}, ${city.count} places. Tap to view.`}
            >
              <Text style={styles.cityName}>{city.name}</Text>
              <View style={styles.cityRight}>
                <Text style={styles.cityCount}>{city.count}</Text>
                <Ionicons name="chevron-forward" size={16} color={c.textTertiary} />
              </View>
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
      backgroundColor: c.background,
    },
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xxl,
    },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    errorText: {
      ...typography.body,
      color: c.textSecondary,
      textAlign: 'center',
    },

    // Summary card
    summary: {
      backgroundColor: c.primary,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.md,
      gap: 4,
    },
    summaryTitle: {
      ...typography.label,
      color: 'rgba(255,255,255,0.75)',
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      marginBottom: 4,
    },
    summaryStat: {
      ...typography.body,
      color: 'rgba(255,255,255,0.92)',
      fontSize: 16,
      lineHeight: 26,
    },
    summaryNumber: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 18,
    },

    // Country group
    countryGroup: {
      backgroundColor: c.surface,
      borderRadius: borderRadius.lg,
      marginBottom: spacing.md,
      overflow: 'hidden',
    },
    countryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      gap: spacing.sm,
    },
    countryFlag: {
      fontSize: 22,
    },
    countryName: {
      ...typography.h3,
      color: c.textPrimary,
      flex: 1,
    },
    countryTotal: {
      ...typography.label,
      color: c.primary,
      fontSize: 15,
      fontWeight: '700',
    },

    // City row
    cityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      borderTopWidth: 1,
      borderTopColor: c.divider,
    },
    cityRowPressed: {
      backgroundColor: c.divider,
    },
    cityName: {
      ...typography.body,
      color: c.textPrimary,
      fontSize: 15,
      flex: 1,
    },
    cityRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    cityCount: {
      ...typography.bodySmall,
      color: c.textSecondary,
      fontSize: 14,
      fontWeight: '500',
      minWidth: 30,
      textAlign: 'right',
    },
  });
