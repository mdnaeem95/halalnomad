import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Swipeable } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useTheme } from '../../src/hooks/useTheme';
import { AppColors } from '../../src/constants/theme';
import { useLocation } from '../../src/hooks/useLocation';
import { placeKeys } from '../../src/hooks/usePlaces';
import { useSavedLists, useListPlaces, useRemovePlace } from '../../src/hooks/useSavedLists';
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

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: tripName, headerBackButtonDisplayMode: 'minimal' }} />

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
  });
