/**
 * M3 Wk1 — the day-assignment picker (tap-to-assign v1; drag comes later).
 *
 * Compact bottom sheet: Ungrouped, Day 1…Day N, and a "New day" row capped
 * at DAY_SOFT_CAP. Day naming is numbers-only by locked decision — no
 * editable day names. Selection writes through the caller (useAssignDay →
 * FIFO queue), so the sheet itself is stateless beyond visibility.
 */

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { DAY_SOFT_CAP } from '../hooks/useSavedLists';
import { AppColors, borderRadius, shadows, spacing, typography } from '../constants/theme';

interface Props {
  visible: boolean;
  placeName: string;
  /** The place's current assignment (null = Ungrouped). */
  currentDay: number | null;
  /** Highest day index currently present in the trip (0 = none yet). */
  maxDay: number;
  onSelect: (dayIndex: number | null) => void;
  onClose: () => void;
}

export function DayPickerSheet({ visible, placeName, currentDay, maxDay, onSelect, onClose }: Props) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);

  const highest = Math.max(maxDay, currentDay ?? 0);
  const newDay = highest + 1;
  const canAddDay = newDay <= DAY_SOFT_CAP;

  function choose(day: number | null) {
    Haptics.selectionAsync();
    onSelect(day);
    onClose();
  }

  const options: { day: number | null; label: string; isNew?: boolean }[] = [
    { day: null, label: t('trips.ungrouped') },
    ...Array.from({ length: highest }, (_, i) => ({
      day: i + 1,
      label: t('trips.day', { n: i + 1 }),
    })),
    ...(canAddDay ? [{ day: newDay, label: t('trips.newDay', { n: newDay }), isNew: true }] : []),
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPress} onPress={onClose} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} accessibilityRole="header">
                {t('trips.assignDayTitle')}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {placeName}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityLabel={t('common.done')}
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={c.textTertiary} />
            </Pressable>
          </View>

          <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={styles.rows}>
            {options.map((o) => {
              const selected = o.day === currentDay && !o.isNew;
              return (
                <Pressable
                  key={o.day ?? 'ungrouped'}
                  style={styles.row}
                  onPress={() => choose(o.day)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={o.label}
                >
                  <Text style={[styles.rowLabel, o.isNew && { color: c.primary }]}>
                    {o.label}
                  </Text>
                  {selected ? (
                    <Ionicons name="checkmark-circle" size={24} color={c.primary} />
                  ) : o.isNew ? (
                    <Ionicons name="add-circle-outline" size={24} color={c.primary} />
                  ) : null}
                </Pressable>
              );
            })}
            {!canAddDay && (
              <Text style={styles.capNote}>{t('trips.dayCapMessage', { max: DAY_SOFT_CAP })}</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    backdropPress: { ...StyleSheet.absoluteFillObject },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      maxHeight: '70%',
      ...shadows.lg,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: c.divider,
      marginBottom: spacing.md,
    },
    header: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm, gap: spacing.sm },
    title: { ...typography.h3, color: c.textPrimary },
    subtitle: { ...typography.bodySmall, color: c.textSecondary, marginTop: 2 },
    rows: { marginTop: spacing.xs },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 48, // ≥44pt target
      paddingVertical: spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    rowLabel: { ...typography.body, color: c.textPrimary },
    capNote: { ...typography.caption, color: c.textTertiary, marginTop: spacing.sm },
  });
