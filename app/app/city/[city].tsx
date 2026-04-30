import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { usePlacesByCity } from '../../src/hooks/usePlaces';
import { useTheme } from '../../src/hooks/useTheme';
import { Place } from '../../src/types';
import { PlaceCard } from '../../src/components/PlaceCard';
import { AppColors, spacing, typography } from '../../src/constants/theme';

/**
 * Places-by-city detail screen. Reached from the Browse view when a
 * user taps a city row.
 *
 * Sorted by halal_level desc + verification_count desc — most
 * trustworthy places surface first. Caps at 500 places per city
 * (we don't have any cities at that scale yet).
 */
export default function CityScreen() {
  const params = useLocalSearchParams<{ city: string }>();
  const city = params.city ? decodeURIComponent(params.city) : undefined;
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);
  const { data: places, isLoading, error } = usePlacesByCity(city);

  function handlePlacePress(place: Place) {
    router.push(`/place/${place.id}`);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: city ?? 'City',
          headerBackButtonDisplayMode: 'minimal',
        }}
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>Couldn't load places.</Text>
        </View>
      ) : !places || places.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No places yet in {city}.</Text>
          <Text style={styles.emptySubtext}>
            Be the first to add one — open the Add tab.
          </Text>
        </View>
      ) : (
        <FlashList
          data={places}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PlaceCard place={item} onPress={handlePlacePress} />
          )}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              <Text style={styles.headerCount}>{places.length}</Text>
              <Text style={styles.headerLabel}>
                {places.length === 1 ? 'verified Halal place' : 'verified Halal places'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: c.background,
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
    emptyText: {
      ...typography.h3,
      color: c.textPrimary,
      textAlign: 'center',
      marginBottom: spacing.xs,
    },
    emptySubtext: {
      ...typography.body,
      color: c.textTertiary,
      textAlign: 'center',
    },
    list: {
      paddingTop: 0,
      paddingBottom: spacing.xxl,
    },
    header: {
      paddingHorizontal: spacing.md,
      paddingTop: spacing.md,
      paddingBottom: spacing.lg,
    },
    headerCount: {
      ...typography.h1,
      color: c.primary,
      fontSize: 36,
      lineHeight: 40,
    },
    headerLabel: {
      ...typography.body,
      color: c.textSecondary,
      marginTop: 2,
    },
  });
