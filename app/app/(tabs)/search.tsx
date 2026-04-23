import React, { useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import { useSearchPlaces } from '../../src/hooks/usePlaces';
import { usePremium } from '../../src/hooks/usePremium';
import { useTheme } from '../../src/hooks/useTheme';
import { useAppStore } from '../../src/stores/app-store';
import { CuisineType, CUISINE_LABELS, Place } from '../../src/types';
import { PlaceCard } from '../../src/components/PlaceCard';
import { PremiumLockBanner } from '../../src/components/PremiumGate';
import { PlaceListSkeleton } from '../../src/components/Skeleton';
import {
  borderRadius,
  colors,
  shadows,
  spacing,
  typography,
} from '../../src/constants/theme';

const CUISINE_FILTERS: { key: CuisineType; label: string }[] = Object.entries(
  CUISINE_LABELS
).map(([key, label]) => ({ key: key as CuisineType, label }));

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function SearchScreen() {
  const { colors: c } = useTheme();
  const { isPremium } = usePremium();
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const cuisineFilter = useAppStore((s) => s.searchFilters.cuisineType);
  const setSearchFilters = useAppStore((s) => s.setSearchFilters);

  const debouncedQuery = useDebounce(searchQuery, 300);
  const hasInput = debouncedQuery.length > 0 || !!cuisineFilter;

  const {
    data: results = [],
    isLoading,
    refetch,
    isRefetching,
  } = useSearchPlaces(debouncedQuery, cuisineFilter);

  function handlePlacePress(place: Place) {
    router.push(`/place/${place.id}`);
  }

  function toggleCuisine(key: CuisineType) {
    setSearchFilters({
      cuisineType: cuisineFilter === key ? null : key,
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TextInput
          style={[styles.input, { backgroundColor: c.surface, color: c.textPrimary, borderColor: c.border }]}
          placeholder="Search Halal places..."
          placeholderTextColor={c.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <Pressable
            style={styles.clearButton}
            onPress={() => setSearchQuery('')}
          >
            <Text style={styles.clearText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {/* Cuisine filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipList}
        style={styles.chipScroll}
      >
        {CUISINE_FILTERS.map((item) => (
          <Pressable
            key={item.key}
            style={[
              styles.chip,
              cuisineFilter === item.key && styles.chipActive,
            ]}
            onPress={() => toggleCuisine(item.key)}
          >
            <Text
              style={[
                styles.chipText,
                cuisineFilter === item.key && styles.chipTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Premium filters upsell */}
      {!isPremium && (
        <View style={{ paddingHorizontal: spacing.sm, paddingBottom: spacing.sm }}>
          <PremiumLockBanner message="Advanced Filters — zabihah-only, no-alcohol, dietary preferences" />
        </View>
      )}

      {/* Results */}
      {isLoading && hasInput ? (
        <PlaceListSkeleton count={4} />
      ) : (
        <FlashList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PlaceCard place={item} onPress={handlePlacePress} />
          )}

          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            hasInput ? (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>No places found.</Text>
                <Text style={styles.emptySubtext}>
                  Try a different search or add a new place.
                </Text>
              </View>
            ) : (
              <View style={styles.centered}>
                <Text style={styles.emptyText}>
                  Search for Halal restaurants, cafes, and more.
                </Text>
              </View>
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: colors.textPrimary,
    ...shadows.sm,
  },
  clearButton: {
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  clearText: {
    ...typography.label,
    color: colors.textTertiary,
  },
  chipScroll: {
    flexGrow: 0,
    maxHeight: 44,
  },
  chipList: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    alignItems: 'center',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
    flexShrink: 0,
  },
  chipTextActive: {
    color: colors.white,
  },
  list: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    marginTop: spacing.xxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
