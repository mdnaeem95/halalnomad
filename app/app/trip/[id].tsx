import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, Pressable, Share, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import * as Clipboard from 'expo-clipboard';
import { haptics } from '../../src/lib/haptics';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient, onlineManager } from '@tanstack/react-query';
import { useTheme } from '../../src/hooks/useTheme';
import { AppColors } from '../../src/constants/theme';
import { useLocation } from '../../src/hooks/useLocation';
import { placeKeys } from '../../src/hooks/usePlaces';
import {
  useSavedLists,
  useListPlaces,
  useRemovePlace,
  useReorderPlace,
  useAssignDay,
  useShareTrip,
  useSetTripVisibility,
} from '../../src/hooks/useSavedLists';
import { isShareTitleBlocked } from '../../src/services/saved-lists';
import { DayPickerSheet } from '../../src/components/DayPickerSheet';
import { SharedTripViewer } from '../../src/components/SharedTripViewer';
import { PlaceCard } from '../../src/components/PlaceCard';
import { Toast } from '../../src/components/AppDialog';
import { placeHref } from '../../src/lib/navigation';
import { haversineKm, formatDistance } from '../../src/lib/distance';
import { track, EVENTS } from '../../src/lib/analytics';
import { computeWithinDayMove } from '../../src/lib/trip-reorder';
import { ListPlace } from '../../src/types';

const SHARE_BASE = 'https://halalnomad.travel/trip/';

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const { location } = useLocation();

  const queryClient = useQueryClient();
  const { data: lists } = useSavedLists();
  const list = (lists ?? []).find((l) => l.id === id);
  // Viewer dispatch: once lists have loaded and this id is NOT one we own, the
  // param is a share token → render the read-only viewer (M4). Anonymous users
  // have no owned lists, so a share link always lands here for them.
  const isViewer = !!lists && !list;
  const { data: places, isLoading } = useListPlaces(id);
  const removePlace = useRemovePlace();
  const reorderPlace = useReorderPlace();
  const shareTrip = useShareTrip();
  const setVisibility = useSetTripVisibility();

  // Reorder edit mode (M2 Wk3). Time-box call, documented in the Wk3 report:
  // free drag on the current gesture stack (FlashList + Swipeable, Animated
  // only, variable-height cards) is the "drag fights the stack" case the
  // brief anticipated — shipped the sanctioned fallback instead: an explicit
  // edit mode with 44pt move up/down controls (better VoiceOver semantics
  // than drag, zero conflict with swipe-to-remove, which is disabled while
  // editing). Drag elegance lands in M3 alongside the day-grouping drag work.
  const [editMode, setEditMode] = useState(false);

  // M3 day grouping (tap-to-assign v1). Sections appear once any place has a
  // day; Ungrouped renders LAST (days are the itinerary, Ungrouped is the
  // inbox at the bottom — kept stable per the locked decision). Empty
  // intermediate days render to preserve the trip's structure. Within a day,
  // the existing global `position` orders rows.
  const assignDay = useAssignDay();
  const [dayPickerFor, setDayPickerFor] = useState<ListPlace | null>(null);
  const maxDay = Math.max(0, ...(places ?? []).map((p) => p.day_index ?? 0));
  const anyDays = maxDay > 0;

  type Row =
    | { type: 'header'; day: number | null; placeCount: number }
    | { type: 'place'; item: ListPlace };
  const rows: Row[] = useMemo(() => {
    const ps = places ?? [];
    if (!anyDays) return ps.map((item) => ({ type: 'place' as const, item }));
    const out: Row[] = [];
    for (let d = 1; d <= maxDay; d += 1) {
      const inDay = ps.filter((p) => p.day_index === d);
      out.push({ type: 'header', day: d, placeCount: inDay.length });
      inDay.forEach((item) => out.push({ type: 'place', item }));
    }
    const ungrouped = ps.filter((p) => p.day_index == null);
    if (ungrouped.length > 0) {
      out.push({ type: 'header', day: null, placeCount: ungrouped.length });
      ungrouped.forEach((item) => out.push({ type: 'place', item }));
    }
    return out;
  }, [places, anyDays, maxDay]);

  function handleAssignDay(place: ListPlace, dayIndex: number | null) {
    if (!id) return;
    assignDay.mutate({ listId: id, placeId: place.id, dayIndex });
    AccessibilityInfo.announceForAccessibility(
      dayIndex == null
        ? t('trips.a11yDayUnassigned', { name: place.name_en })
        : t('trips.a11yDayAssigned', { name: place.name_en, n: dayIndex })
    );
  }

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
    // Owner-only event — a viewer (isViewer) fires shared_trip_list_viewed instead.
    if (id && places && list && !openedRef.current) {
      openedRef.current = true;
      track(EVENTS.TRIP_LIST_OPENED, {
        list_id: id,
        place_count: places.length,
        source_screen: 'tab',
      });
    }
  }, [id, places, list]);

  /** M4 share flow (owner). Needs network (server-minted token) — offline is a
   *  graceful state, never a queued write. Already-shared trips offer re-share
   *  or stop-sharing; a denylisted title routes to a rename prompt. */
  async function handleShare() {
    if (!id || !list) return;
    if (!onlineManager.isOnline()) {
      Alert.alert(t('trips.shareOfflineTitle'), t('trips.shareOfflineMessage'));
      return;
    }
    const doShare = async (token: string, wasPrivate: boolean) => {
      if (wasPrivate) {
        track(EVENTS.TRIP_LIST_VISIBILITY_CHANGED, {
          list_id: id,
          from_visibility: 'private',
          to_visibility: 'unlisted',
        });
      }
      const url = `${SHARE_BASE}${token}`;
      try {
        const res = await Share.share({ message: t('trips.shareMessage', { name: list.name, url }), url });
        if (res.action === Share.sharedAction) {
          track(EVENTS.TRIP_LIST_SHARED, { list_id: id, share_method: 'share_sheet' });
        }
      } catch {
        /* user dismissed — no-op */
      }
    };
    // Already shared → reuse token; offer copy / stop-sharing too.
    if (list.share_token && list.visibility === 'unlisted') {
      const token = list.share_token;
      Alert.alert(t('trips.shareTrip'), t('trips.shareLinkOn'), [
        { text: t('trips.share'), onPress: () => doShare(token, false) },
        {
          text: t('trips.shareCopy'),
          onPress: async () => {
            await Clipboard.setStringAsync(`${SHARE_BASE}${token}`);
            track(EVENTS.TRIP_LIST_SHARED, { list_id: id, share_method: 'copy_link' });
            setToast({ visible: true, message: t('trips.shareCopied') });
          },
        },
        {
          text: t('trips.shareTurnOff'),
          style: 'destructive',
          onPress: () => {
            setVisibility.mutate({ listId: id, visibility: 'private' });
            track(EVENTS.TRIP_LIST_VISIBILITY_CHANGED, {
              list_id: id,
              from_visibility: 'unlisted',
              to_visibility: 'private',
            });
          },
        },
        { text: t('common.cancel'), style: 'cancel' },
      ]);
      return;
    }
    // First share (or re-enabling after revoke): mint/reuse token then share.
    const wasPrivate = list.visibility !== 'unlisted';
    haptics.selection();
    shareTrip.mutate(id, {
      onSuccess: (token) => doShare(token, wasPrivate),
      onError: (err) => {
        if (isShareTitleBlocked(err)) {
          Alert.alert(t('trips.shareTitleBlockedTitle'), t('trips.shareTitleBlockedMessage'));
        } else {
          Alert.alert(t('trips.shareOfflineTitle'), t('trips.shareOfflineMessage'));
        }
      },
    });
  }

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

  // Edit-mode sections. When the trip has days, edit mode mirrors the read
  // view's grouping so reorder is within-day (a row can't cross a header —
  // between-day movement is the chip→picker's job). A dayless trip is one
  // implicit section (day null) and renders exactly like the M2 flat list.
  const editSections = useMemo(() => {
    const ps = [...(places ?? [])].sort((a, b) => a.position - b.position);
    if (!anyDays) return [{ day: null as number | null, items: ps }];
    const out: { day: number | null; items: ListPlace[] }[] = [];
    for (let d = 1; d <= maxDay; d += 1) {
      out.push({ day: d, items: ps.filter((p) => p.day_index === d) });
    }
    const ung = ps.filter((p) => p.day_index == null);
    if (ung.length > 0) out.push({ day: null, items: ung });
    return out;
  }, [places, anyDays, maxDay]);

  /** Move a place one slot up/down WITHIN its day section. Delegates the
   *  1000-step midpoint + whole-trip re-space math to computeWithinDayMove so
   *  the (future) drag path shares it. Section-scoped: an edge move is a no-op.
   *  Fires trip_list_day_reordered when day-grouped, else the flat M2 event. */
  function move(dayIndex: number | null, sectionIdx: number, dir: -1 | 1) {
    if (!id || !places) return;
    const r = computeWithinDayMove(places, dayIndex, sectionIdx, dir);
    if (!r) return;
    const item = places.find((p) => p.id === r.placeId);
    haptics.selection();
    reorderPlace.mutate({
      listId: id,
      placeId: r.placeId,
      position: r.position,
      fromIndex: r.fromIndex,
      toIndex: r.toIndex,
      respace: r.respace,
      // day-scoped only when the trip actually has days (dayless => flat event)
      ...(anyDays ? { dayIndex } : {}),
      via: 'arrows',
    });
    const sectionLen = editSections.find((s) => s.day === dayIndex)?.items.length ?? 0;
    if (item) {
      // Name the section in the announcement when the trip has days, so a
      // VoiceOver user knows which day the row landed in (M3 Wk-3 A11y sweep).
      const announce = !anyDays
        ? t('trips.a11yMovedAnnounce', { name: item.name_en, pos: r.toIndex + 1, count: sectionLen })
        : dayIndex == null
          ? t('trips.a11yMovedInUngrouped', { name: item.name_en, pos: r.toIndex + 1, count: sectionLen })
          : t('trips.a11yMovedInDay', {
              name: item.name_en,
              pos: r.toIndex + 1,
              count: sectionLen,
              day: dayIndex,
            });
      AccessibilityInfo.announceForAccessibility(announce);
    }
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
            {!editMode && (
              <Pressable
                onPress={handleShare}
                hitSlop={10}
                style={styles.headerAction}
                accessibilityRole="button"
                accessibilityLabel={t('trips.shareTrip')}
              >
                <Ionicons
                  name={list?.visibility === 'unlisted' ? 'share-social' : 'share-social-outline'}
                  size={20}
                  color={c.textOnPrimary}
                />
              </Pressable>
            )}
            <Pressable
              onPress={() => {
                haptics.selection();
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

  // Read-only viewer dispatch (M4): this id is a share token, not an owned list.
  if (isViewer && id) {
    return <SharedTripViewer token={id} />;
  }

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
        //
        // M3 Wk2: grouped by day so arrows are section-scoped (up/down move
        // within a day only; disabled at the section's ends — a row never
        // crosses a header). Section headers only render when the trip has days.
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
          {editSections.map((section) => (
            <View key={`sec-${section.day ?? 'un'}`}>
              {anyDays && (
                <View
                  style={styles.daySection}
                  accessibilityRole="header"
                  accessible
                  accessibilityLabel={
                    section.day == null
                      ? t('trips.a11yUngroupedSection', { count: section.items.length })
                      : t('trips.a11yDaySection', { n: section.day, count: section.items.length })
                  }
                >
                  <Text style={styles.daySectionTitle}>
                    {section.day == null ? t('trips.ungrouped') : t('trips.day', { n: section.day })}
                  </Text>
                  <Text style={styles.daySectionCount}>
                    {section.items.length === 0
                      ? t('trips.placeCount_zero')
                      : t('trips.placeCount', { count: section.items.length })}
                  </Text>
                </View>
              )}
              {section.items.map((item, index) => (
                <View key={item.id} style={styles.editRow}>
                  <View style={styles.editCard} pointerEvents="none">
                    {/* Navigation is parked while editing; onPress is a no-op. */}
                    <PlaceCard place={item} onPress={() => {}} distance={distanceFor(item)} />
                  </View>
                  <View style={styles.moveControls}>
                    <Pressable
                      style={[styles.moveButton, index === 0 && styles.moveButtonDisabled]}
                      onPress={() => move(section.day, index, -1)}
                      disabled={index === 0}
                      accessibilityRole="button"
                      accessibilityLabel={t('trips.a11yMoveUp', { name: item.name_en })}
                      accessibilityState={{ disabled: index === 0 }}
                    >
                      <Ionicons name="chevron-up" size={22} color={index === 0 ? c.textTertiary : c.primary} />
                    </Pressable>
                    <Pressable
                      style={[
                        styles.moveButton,
                        index === section.items.length - 1 && styles.moveButtonDisabled,
                      ]}
                      onPress={() => move(section.day, index, 1)}
                      disabled={index === section.items.length - 1}
                      accessibilityRole="button"
                      accessibilityLabel={t('trips.a11yMoveDown', { name: item.name_en })}
                      accessibilityState={{ disabled: index === section.items.length - 1 }}
                    >
                      <Ionicons
                        name="chevron-down"
                        size={22}
                        color={index === section.items.length - 1 ? c.textTertiary : c.primary}
                      />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </ScrollView>
      ) : (
        <FlashList
          data={rows}
          keyExtractor={(row) => (row.type === 'header' ? `day-${row.day ?? 'un'}` : row.item.id)}
          getItemType={(row) => row.type}
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
          renderItem={({ item: row }) =>
            row.type === 'header' ? (
              <View
                style={styles.daySection}
                accessibilityRole="header"
                accessible
                accessibilityLabel={
                  row.day == null
                    ? t('trips.a11yUngroupedSection', { count: row.placeCount })
                    : t('trips.a11yDaySection', { n: row.day, count: row.placeCount })
                }
              >
                <Text style={styles.daySectionTitle}>
                  {row.day == null ? t('trips.ungrouped') : t('trips.day', { n: row.day })}
                </Text>
                <Text style={styles.daySectionCount}>
                  {row.placeCount === 0
                    ? t('trips.placeCount_zero')
                    : t('trips.placeCount', { count: row.placeCount })}
                </Text>
              </View>
            ) : (
              <Swipeable
                ref={(r) => {
                  swipeRefs.current[row.item.id] = r;
                }}
                renderRightActions={renderRightActions(row.item)}
                overshootRight={false}
                rightThreshold={40}
              >
                <PlaceCard
                  place={row.item}
                  onPress={(p) => router.push(placeHref(p.id, 'trip_detail'))}
                  distance={distanceFor(row.item)}
                  headerAccessory={
                    /* Day chip — tap-to-assign (M3 v1). In-layout via the
                       accessory slot, so long names truncate against it and
                       it never covers the halal badge. */
                    <Pressable
                      style={[styles.dayChip, row.item.day_index == null && styles.dayChipEmpty]}
                      onPress={() => setDayPickerFor(row.item)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={t('trips.a11yDayChip', { name: row.item.name_en })}
                    >
                      <Ionicons
                        name="calendar-outline"
                        size={13}
                        color={row.item.day_index == null ? c.textSecondary : c.textOnPrimary}
                      />
                      <Text
                        style={[
                          styles.dayChipText,
                          row.item.day_index == null && { color: c.textSecondary },
                        ]}
                      >
                        {row.item.day_index == null
                          ? t('trips.dayChipUnassigned')
                          : t('trips.day', { n: row.item.day_index })}
                      </Text>
                    </Pressable>
                  }
                />
              </Swipeable>
            )
          }
        />
      )}

      {dayPickerFor && (
        <DayPickerSheet
          visible
          placeName={dayPickerFor.name_en}
          currentDay={dayPickerFor.day_index}
          maxDay={maxDay}
          onSelect={(d) => handleAssignDay(dayPickerFor, d)}
          onClose={() => setDayPickerFor(null)}
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
    daySection: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 8,
      marginTop: 10,
      marginBottom: 6,
    },
    daySectionTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
    daySectionCount: { fontSize: 13, color: c.textTertiary },
    // ≥44pt effective target (28 high + hitSlop 8). Lives in PlaceCard's
    // header row via the accessory slot — flex layout, never overlaps.
    dayChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 28,
      paddingHorizontal: 10,
      borderRadius: 14,
      backgroundColor: c.primary,
    },
    dayChipEmpty: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    dayChipText: { fontSize: 12, fontWeight: '700', color: c.textOnPrimary },
  });
