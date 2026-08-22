import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AccessibilityInfo } from 'react-native';
import { haptics } from '../../src/lib/haptics';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSearchPlaces } from '../../src/hooks/usePlaces';
import { useListPlaces } from '../../src/hooks/useSavedLists';
import { usePremium } from '../../src/hooks/usePremium';
import { useTheme } from '../../src/hooks/useTheme';
import { useAppStore } from '../../src/stores/app-store';
import { CuisineType, CUISINE_LABELS, Place } from '../../src/types';
import { placeHref } from '../../src/lib/navigation';
import { PlaceCard } from '../../src/components/PlaceCard';
import { PremiumLockBanner } from '../../src/components/PremiumGate';
import { FEATURES } from '../../src/constants/features';
import { PlaceListSkeleton } from '../../src/components/Skeleton';
import { track, EVENTS } from '../../src/lib/analytics';
import {
  AppColors,
  borderRadius,
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
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);
  const { isPremium } = usePremium();
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const cuisineFilter = useAppStore((s) => s.searchFilters.cuisineType);
  const setSearchFilters = useAppStore((s) => s.setSearchFilters);

  // Trip scope (M2 Wk3): arriving via a trip's search affordance pre-scopes
  // search to that trip via a clearable chip. Scoped search never hits the
  // server — it filters the trip's own (persisted) place cache, so it works
  // offline over cached places. Clearing the chip returns to catalog search.
  const params = useLocalSearchParams<{ listId?: string; listName?: string }>();
  const [scope, setScope] = useState<{ listId: string; listName: string } | null>(null);
  useEffect(() => {
    if (params.listId) {
      setScope({ listId: params.listId, listName: params.listName ?? '' });
    }
  }, [params.listId, params.listName]);

  function clearScope() {
    haptics.selection();
    setScope(null);
    // Drop the stale params so re-focusing the tab doesn't resurrect the chip.
    router.setParams({ listId: undefined, listName: undefined });
    AccessibilityInfo.announceForAccessibility(t('trips.a11yScopeCleared'));
  }

  const debouncedQuery = useDebounce(searchQuery, 300);
  const hasInput = debouncedQuery.length > 0 || !!cuisineFilter;

  const {
    data: catalogResults = [],
    isLoading: catalogLoading,
    refetch,
    isRefetching,
  } = useSearchPlaces(scope ? '' : debouncedQuery, scope ? null : cuisineFilter);
  const { data: tripPlaces = [] } = useListPlaces(scope?.listId);

  // Scoped mode filters the trip's cached places client-side (name in either
  // script + the cuisine chips still apply). Empty query = browse the trip.
  const scopedResults = React.useMemo(() => {
    if (!scope) return [];
    const q = debouncedQuery.trim().toLowerCase();
    return tripPlaces.filter((p) => {
      if (cuisineFilter && p.cuisine_type !== cuisineFilter) return false;
      if (!q) return true;
      return (
        p.name_en.toLowerCase().includes(q) ||
        (p.name_local ?? '').toLowerCase().includes(q)
      );
    });
  }, [scope, tripPlaces, debouncedQuery, cuisineFilter]);

  const results = scope ? scopedResults : catalogResults;
  const isLoading = scope ? false : catalogLoading;

  // search_performed: fire once per resolved (query, cuisine) once the query
  // settles. cuisine_filter_count is 0|1 — the cuisine filter is single-select
  // today (one chip at a time), not multi. `query` is an event property only,
  // never a person property.
  const lastSearchKey = useRef<string | null>(null);
  useEffect(() => {
    if (!hasInput || isLoading) return;
    const key = `${debouncedQuery}|${cuisineFilter ?? ''}|${scope?.listId ?? ''}`;
    if (lastSearchKey.current === key) return;
    lastSearchKey.current = key;
    track(EVENTS.SEARCH_PERFORMED, {
      query: debouncedQuery,
      cuisine_filter_count: cuisineFilter ? 1 : 0,
      result_count: results.length,
      is_no_results: results.length === 0,
      // M2 Wk3: no new event name — scope discriminates trip-scoped searches.
      scope: scope ? 'trip' : 'catalog',
      ...(scope ? { list_id: scope.listId } : {}),
    });
  }, [debouncedQuery, cuisineFilter, isLoading, results, hasInput, scope]);

  function handlePlacePress(place: Place) {
    router.push(placeHref(place.id, 'search'));
  }

  function toggleCuisine(key: CuisineType) {
    const isRemoving = cuisineFilter === key;
    setSearchFilters({
      cuisineType: isRemoving ? null : key,
    });
    track(EVENTS.CUISINE_FILTER_USED, {
      cuisine_type: key,
      action: isRemoving ? 'removed' : 'added',
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

      {/* Trip scope chip (M2 Wk3) */}
      {scope && (
        <View style={styles.scopeRow}>
          <Pressable
            style={styles.scopeChip}
            onPress={clearScope}
            accessibilityRole="button"
            accessibilityLabel={t('trips.a11yScopeChip', { name: scope.listName })}
            accessibilityHint={t('trips.a11yScopeClearHint')}
          >
            <Text style={styles.scopeChipText} numberOfLines={1}>
              {t('trips.searchScopeChip', { name: scope.listName })}
            </Text>
            <Ionicons name="close-circle" size={18} color={c.textOnPrimary} />
          </Pressable>
        </View>
      )}

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

      {/* Premium filters upsell — hidden until Phase 2 features
          ship and Premium is re-enabled. See src/constants/features.ts. */}
      {FEATURES.premiumEnabled && !isPremium && (
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
              tintColor={c.primary}
              colors={[c.primary]}
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

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  searchBar: {
    flexDirection: 'row',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.body,
    color: c.textPrimary,
    ...shadows.sm,
  },
  clearButton: {
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  clearText: {
    ...typography.label,
    color: c.textTertiary,
  },
  scopeRow: {
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
  },
  // ≥44pt target.
  scopeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.primary,
    borderRadius: 22,
    paddingHorizontal: 14,
    minHeight: 44,
    maxWidth: '80%',
  },
  scopeChipText: {
    ...typography.caption,
    color: c.textOnPrimary,
    fontWeight: '700',
    flexShrink: 1,
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
    backgroundColor: c.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: c.border,
  },
  chipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  chipText: {
    ...typography.caption,
    color: c.textSecondary,
    fontWeight: '600',
    flexShrink: 0,
  },
  chipTextActive: {
    color: c.textOnPrimary,
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
    color: c.textSecondary,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.bodySmall,
    color: c.textTertiary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
