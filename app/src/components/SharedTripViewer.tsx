/**
 * M4 Wk1 — read-only viewer for a shared trip (opened via /trip/<token>).
 *
 * Strictly read-only: no edit / save / reorder affordances. Day sections render
 * like the owner view; place rows navigate to place detail as normal. Author
 * display name is shown by default (locked Q3). Works unauthenticated (the
 * get_shared_trip RPC is token-gated, not auth-gated).
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { onlineManager } from '@tanstack/react-query';
import { useTheme } from '../hooks/useTheme';
import { AppColors } from '../constants/theme';
import { useSharedTrip } from '../hooks/useSavedLists';
import { useAuth } from '../hooks/useAuth';
import { PlaceCard } from './PlaceCard';
import { placeHref } from '../lib/navigation';
import { track, EVENTS } from '../lib/analytics';
import { ListPlace } from '../types';

export function SharedTripViewer({ token }: { token: string }) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const styles = useMemo(() => createStyles(c), [c]);
  const { session } = useAuth();
  const { data, isLoading, isError } = useSharedTrip(token);

  // Fire the viewer event once per successful load (anonymous distinct_id when
  // signed out — PostHog handles that automatically).
  const trackedRef = useRef(false);
  useEffect(() => {
    if (data && !trackedRef.current) {
      trackedRef.current = true;
      const sharedAt = data.list.last_shared_at ? new Date(data.list.last_shared_at).getTime() : null;
      const days = sharedAt ? Math.floor((Date.now() - sharedAt) / 86_400_000) : 0;
      track(EVENTS.SHARED_TRIP_LIST_VIEWED, {
        list_id: data.list.id,
        is_authenticated: !!session,
        days_since_shared: days,
      });
    }
  }, [data, session]);

  // Group places into day sections (days ascending, Ungrouped last) — same
  // shape as the owner view, minus all the edit machinery.
  type Row = { type: 'header'; day: number | null; count: number } | { type: 'place'; item: ListPlace };
  const rows: Row[] = useMemo(() => {
    const ps = data?.places ?? [];
    const maxDay = Math.max(0, ...ps.map((p) => p.day_index ?? 0));
    if (maxDay === 0) return ps.map((item) => ({ type: 'place' as const, item }));
    const out: Row[] = [];
    for (let d = 1; d <= maxDay; d += 1) {
      const inDay = ps.filter((p) => p.day_index === d);
      out.push({ type: 'header', day: d, count: inDay.length });
      inDay.forEach((item) => out.push({ type: 'place', item }));
    }
    const ung = ps.filter((p) => p.day_index == null);
    if (ung.length > 0) {
      out.push({ type: 'header', day: null, count: ung.length });
      ung.forEach((item) => out.push({ type: 'place', item }));
    }
    return out;
  }, [data]);

  const title = data?.list.name ?? t('trips.sharedTitle');

  const centered = (icon: string, heading: string, sub: string) => (
    <View style={styles.center}>
      <Ionicons name={icon as never} size={44} color={c.primaryLight} />
      <Text style={styles.emptyTitle}>{heading}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title, headerBackButtonDisplayMode: 'minimal' }} />
      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={c.primary} /></View>
      ) : isError && !onlineManager.isOnline() ? (
        // Share viewers aren't the at-restaurant persona — no offline cache.
        centered('cloud-offline-outline', t('trips.sharedOfflineTitle'), t('trips.sharedOfflineSub'))
      ) : !data ? (
        // null = wrong / private / revoked token (indistinguishable by design).
        centered('link-outline', t('trips.sharedGoneTitle'), t('trips.sharedGoneSub'))
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          <View style={styles.sharedBy}>
            <Ionicons name="person-circle-outline" size={16} color={c.textSecondary} />
            <Text style={styles.sharedByText}>
              {data.list.author
                ? t('trips.sharedByName', { name: data.list.author })
                : t('trips.sharedByAnon')}
            </Text>
          </View>
          {rows.map((row, i) =>
            row.type === 'header' ? (
              <View
                key={`day-${row.day ?? 'un'}`}
                style={styles.daySection}
                accessibilityRole="header"
                accessible
                accessibilityLabel={
                  row.day == null
                    ? t('trips.a11yUngroupedSection', { count: row.count })
                    : t('trips.a11yDaySection', { n: row.day, count: row.count })
                }
              >
                <Text style={styles.daySectionTitle}>
                  {row.day == null ? t('trips.ungrouped') : t('trips.day', { n: row.day })}
                </Text>
                <Text style={styles.daySectionCount}>{t('trips.placeCount', { count: row.count })}</Text>
              </View>
            ) : (
              <View key={`${row.item.id}-${i}`} style={styles.placeRow}>
                <PlaceCard place={row.item} onPress={(p) => router.push(placeHref(p.id, 'shared_trip'))} />
              </View>
            )
          )}
          <Text style={styles.footNote}>{t('trips.sharedFootNote')}</Text>
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
    emptyTitle: { fontSize: 18, fontWeight: '700', color: c.textPrimary, marginTop: 6 },
    emptySub: { fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 21 },
    listContent: { padding: 16 },
    sharedBy: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
    sharedByText: { fontSize: 13, color: c.textSecondary, fontWeight: '600' },
    placeRow: { marginBottom: 4 },
    daySection: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 10, marginBottom: 6 },
    daySectionTitle: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
    daySectionCount: { fontSize: 13, color: c.textTertiary },
    footNote: { fontSize: 12, color: c.textTertiary, textAlign: 'center', marginTop: 16, lineHeight: 18 },
  });
