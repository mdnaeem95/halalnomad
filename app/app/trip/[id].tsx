import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../src/hooks/useTheme';
import { AppColors } from '../../src/constants/theme';
import { useLocation } from '../../src/hooks/useLocation';
import { placeKeys } from '../../src/hooks/usePlaces';
import {
  useSavedLists,
  useListPlaces,
  useRemovePlace,
  useReorderPlace,
} from '../../src/hooks/useSavedLists';
import { PlaceCard } from '../../src/components/PlaceCard';
import { Toast } from '../../src/components/AppDialog';
import { placeHref } from '../../src/lib/navigation';
import { haversineKm, formatDistance } from '../../src/lib/distance';
import { track, EVENTS } from '../../src/lib/analytics';
import { ListPlace } from '../../src/types';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const { location } = useLocation();

  const queryClient = useQueryClient();
  const { data: lists } = useSavedLists();
  const list = (lists ?? []).find((l) => l.id === id);
  const { data: places, isLoading } = useListPlaces(id);
  const removePlace = useRemovePlace();
  const reorderPlace = useReorderPlace();

  // Reorder edit mode (M2 Wk3). Time-box call, documented in the Wk3 report:
  // free drag on the current gesture stack (FlashList + Swipeable, Animated
  // only, variable-height cards) is the "drag fights the stack" case the
  // brief anticipated — shipped the sanctioned fallback instead: an explicit
  // edit mode with 44pt move up/down controls (better VoiceOver semantics
  // than drag, zero conflict with swipe-to-remove, which is disabled while
  // editing). Drag elegance lands in M3 alongside the day-grouping drag work.
  const [editMode, setEditMode] = useState(false);

  // Seed each place into the place-detail cache so tapping a place opens offline
  // (place/[id] reads ['places','detail',id], a different key from the join
  // query). Only fill gaps — never clobber fresher detail data.
  useEffect(() => {
    places?.forEach((p) =>
      queryClient.setQueryData(placeKeys.detail(p.id), (old: unknown) => old ?? p)
    );
  }, [places, queryClient]);

  const [toast, setToast] = useState({ visible: false, message: '' });
  const swipeRefs = useRef<Record<string, Swipeable | null>>({});

  const count = places?.length ?? 0;
  const tripName = list?.name ?? t('trips.title');

  // Fire trip_list_opened once, when the place list has resolved (so
  // place_count is accurate).
  const openedRef = useRef(false);
  useEffect(() => {
    if (id && places && !openedRef.current) {
      openedRef.current = true;
      track(EVENTS.TRIP_LIST_OPENED, {
        list_id: id,
        place_count: places.length,
        source_screen: 'tab',
      });
    }
  }, [id, places]);

  function handleRemove(place: ListPlace) {
    if (!id) return;
    swipeRefs.current[place.id]?.close();
    removePlace.mutate({ listId: id, placeId: place.id });
    setToast({ visible: true, message: t('trips.removedToast', { name: tripName }) });
    AccessibilityInfo.announceForAccessibility(t('trips.a11yRemovedAnnounce', { name: tripName }));
  }

  function distanceFor(place: ListPlace): string | undefined {
    if (!location) return undefined;
    return formatDistance(
      haversineKm(location, { latitude: place.latitude, longitude: place.longitude })
    );
  }

  /** Move a place one slot up/down. New position = midpoint of its new
   *  neighbours in the 1000-step space; when the gap is exhausted (<2 apart),
   *  re-space the whole list to (i+1)*1000 through the queue. */
  function movePlace(index: number, dir: -1 | 1) {
    if (!id || !places) return;
    const target = index + dir;
    if (target < 0 || target >= places.length) return;
    const item = places[index];

    const rest = places.filter((_, i) => i !== index);
    const prevNeighbour = target > 0 ? rest[target - 1] : null;
    const nextNeighbour = target < rest.length ? rest[target] : null;

    let position: number;
    if (!prevNeighbour) position = (nextNeighbour?.position ?? 0) - 1000;
    else if (!nextNeighbour) position = prevNeighbour.position + 1000;
    else position = Math.floor((prevNeighbour.position + nextNeighbour.position) / 2);

    Haptics.selectionAsync();

    const collided =
      (prevNeighbour && position <= prevNeighbour.position) ||
      (nextNeighbour && position >= nextNeighbour.position);

    if (collided) {
      const newOrder = [...rest.slice(0, target), item, ...rest.slice(target)];
      reorderPlace.mutate({
        listId: id,
        placeId: item.id,
        position: (target + 1) * 1000,
        fromIndex: index,
        toIndex: target,
        respace: newOrder.map((p, i) => ({ placeId: p.id, position: (i + 1) * 1000 })),
      });
    } else {
      reorderPlace.mutate({
        listId: id,
        placeId: item.id,
        position,
        fromIndex: index,
        toIndex: target,
      });
    }
    AccessibilityInfo.announceForAccessibility(
      t('trips.a11yMovedAnnounce', { name: item.name_en, pos: target + 1, count: places.length })
    );
  }

  const renderRightActions = (place: ListPlace) => () =>
    (
      <Pressable
        style={styles.removeAction}
        onPress={() => handleRemove(place)}
        accessibilityRole="button"
        accessibilityLabel={`${t('trips.remove')} ${place.name_en}`}
        accessibilityHint={t('trips.a11yRemoveHint')}
      >
        <Ionicons name="trash-outline" size={22} color={c.textOnPrimary} />
        <Text style={styles.removeActionText}>{t('trips.remove')}</Text>
      </Pressable>
    );

  // Header: scoped-search entry + reorder toggle (only when there's something
  // to search/reorder).
  const headerRight =
    count > 0
      ? () => (
          <View style={styles.headerActions}>
            {!editMode && (
              <Pressable
                onPress={() =>
                  router.navigate(
                    `/search?listId=${id}&listName=${encodeURIComponent(tripName)}`
                  )
                }
                hitSlop={10}
                style={styles.headerAction}
                accessibilityRole="button"
                accessibilityLabel={t('trips.searchInTrip', { name: tripName })}
              >
                <Ionicons name="search" size={20} color={c.textOnPrimary} />
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setEditMode((v) => !v);
              }}
              hitSlop={10}
              style={styles.headerAction}
              accessibilityRole="button"
              accessibilityLabel={editMode ? t('common.done') : t('trips.reorder')}
            >
              {editMode ? (
                <Text style={styles.headerActionText}>{t('common.done')}</Text>
              ) : (
                <Ionicons name="swap-vertical" size={20} color={c.textOnPrimary} />
              )}
            </Pressable>
          </View>
        )
      : undefined;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: tripName, headerBackButtonDisplayMode: 'minimal', headerRight }}
      />

      {isLoading && !places ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : count === 0 ? (
        <View style={styles.center}>
          <Ionicons name="location-outline" size={48} color={c.primaryLight} />
          <Text style={styles.emptyTitle}>{t('trips.detailEmptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>{t('trips.detailEmptySubtitle')}</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.navigate('/search')}>
            <Text style={styles.primaryButtonText}>{t('trips.findPlaces')}</Text>
          </Pressable>
        </View>
      ) : editMode ? (
        // Edit mode renders a plain non-virtualized list: FlashList re-measures
        // on every data mutation, which read as the whole list "jumping" per
        // move on device. Trip lists are small (soft-capped world), so a
        // ScrollView with per-place keys keeps rows stable — a move swaps two
        // children in place and the scroll offset never shifts.
        <ScrollView contentContainerStyle={styles.listContent}>
          <View style={styles.subheader}>
            <Text style={styles.subheaderCount}>
              {t('trips.placeCount', { count })}
            </Text>
            {list?.is_default && (
              <View style={styles.defaultBadge}>
                <Text style={styles.defaultBadgeText}>{t('trips.defaultBadge')}</Text>
              </View>
            )}
          </View>
          {(places ?? []).map((item, index) => (
            <View key={item.id} style={styles.editRow}>
              <View style={styles.editCard} pointerEvents="none">
                {/* Navigation is parked while editing; onPress is a no-op. */}
                <PlaceCard place={item} onPress={() => {}} distance={distanceFor(item)} />
              </View>
              <View style={styles.moveControls}>
                <Pressable
                  style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
                  onPress={() => movePlace(index, -1)}
                  disabled={index === 0}
                  accessibilityRole="button"
                  accessibilityLabel={t('trips.a11yMoveUp', { name: item.name_en })}
                  accessibilityState={{ disabled: index === 0 }}
                >
                  <Ionicons name="chevron-up" size={22} color={index === 0 ? c.textTertiary : c.primary} />
                </Pressable>
                <Pressable
                  style={[styles.moveButton, index === count - 1 && styles.moveButtonDisabled]}
                  onPress={() => movePlace(index, 1)}
                  disabled={index === count - 1}
                  accessibilityRole="button"
                  accessibilityLabel={t('trips.a11yMoveDown', { name: item.name_en })}
                  accessibilityState={{ disabled: index === count - 1 }}
                >
                  <Ionicons name="chevron-down" size={22} color={index === count - 1 ? c.textTertiary : c.primary} />
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : (
        <FlashList
          data={places ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.subheader}>
              <Text style={styles.subheaderCount}>
                {count === 0 ? t('trips.placeCount_zero') : t('trips.placeCount', { count })}
              </Text>
              {list?.is_default && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultBadgeText}>{t('trips.defaultBadge')}</Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <Swipeable
              ref={(r) => {
                swipeRefs.current[item.id] = r;
              }}
              renderRightActions={renderRightActions(item)}
              overshootRight={false}
              rightThreshold={40}
            >
              <PlaceCard
                place={item}
                onPress={(p) => router.push(placeHref(p.id, 'trip_detail'))}
                distance={distanceFor(item)}
              />
            </Swipeable>
          )}
        />
      )}

      <Toast
        visible={toast.visible}
        message={toast.message}
        variant="success"
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </View>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: c.textPrimary, marginTop: 8 },
    emptySubtitle: { fontSize: 15, color: c.textSecondary, textAlign: 'center', lineHeight: 22 },
    primaryButton: {
      backgroundColor: c.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 10,
      alignItems: 'center',
      marginTop: 8,
    },
    primaryButtonText: { color: c.textOnPrimary, fontSize: 16, fontWeight: '600' },
    listContent: { padding: 16 },
    subheader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    subheaderCount: { fontSize: 14, color: c.textSecondary, fontWeight: '600' },
    defaultBadge: {
      backgroundColor: c.primaryLight + '22',
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    defaultBadgeText: { fontSize: 11, fontWeight: '700', color: c.primary },
    // Full-height red action revealed on left-swipe.
    removeAction: {
      backgroundColor: c.error,
      justifyContent: 'center',
      alignItems: 'center',
      width: 96,
      borderRadius: 12,
      marginBottom: 12,
      gap: 2,
    },
    removeActionText: { color: c.textOnPrimary, fontSize: 12, fontWeight: '700' },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    // ≥44pt targets (12 pad + 20 icon).
    headerAction: { padding: 12 },
    headerActionText: { color: c.textOnPrimary, fontSize: 15, fontWeight: '700' },
    editRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    editCard: { flex: 1 },
    moveControls: { justifyContent: 'center', gap: 4, marginBottom: 12 },
    moveButton: {
      width: 44,
      height: 44,
      borderRadius: 10,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    moveButtonDisabled: { opacity: 0.4 },
  });
