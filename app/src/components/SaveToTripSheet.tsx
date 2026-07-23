/**
 * Trip Planning M2 Wk2 — the "save to which trip?" sheet.
 *
 * Membership toggles, not single-select: each row shows whether this place is
 * already in that trip; tapping toggles membership through the same optimistic
 * write-queue paths the rest of Trip Planning uses (add = place_add, untick =
 * the Wk-1 remove op). Membership renders from the persisted pairs cache, so
 * the sheet is correct offline. "Create new trip" creates (soft 10-cap,
 * source: 'manual') and saves the place into it in one interaction —
 * awaiting the create's enqueue first so the queue stays create-before-add.
 */

import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import {
  LIST_SOFT_CAP,
  useCreateList,
  useListMembership,
  useRemovePlace,
  useSavedLists,
  useSaveToTrip,
} from '../hooks/useSavedLists';
import { LIST_NAME_MAX } from '../services/saved-lists';
import { AppColors, borderRadius, shadows, spacing, typography } from '../constants/theme';
import { Place, SavedList } from '../types';

interface Props {
  visible: boolean;
  place: Place;
  onClose: () => void;
}

export function SaveToTripSheet({ visible, place, onClose }: Props) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);

  const { data: lists = [] } = useSavedLists();
  const { listIds } = useListMembership(place.id);
  const saveToTrip = useSaveToTrip();
  const removePlace = useRemovePlace();
  const createList = useCreateList();

  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Default trip first (badged), rest keep the My Trips updated_at-desc order.
  const sorted = [...lists].sort((a, b) => Number(b.is_default) - Number(a.is_default));
  const atCap = lists.length >= LIST_SOFT_CAP;

  useEffect(() => {
    if (!visible) {
      setCreating(false);
      setDraft('');
      setError(null);
    }
  }, [visible]);

  function toggle(list: SavedList) {
    Haptics.selectionAsync();
    const isMember = listIds.includes(list.id);
    if (isMember) {
      removePlace.mutate({ listId: list.id, placeId: place.id });
      AccessibilityInfo.announceForAccessibility(t('trips.a11yRemovedAnnounce', { name: list.name }));
    } else {
      saveToTrip.mutate({ placeId: place.id, listId: list.id, isFirst: false, title: list.name });
      AccessibilityInfo.announceForAccessibility(t('trips.a11ySavedAnnounce', { name: list.name }));
    }
  }

  async function handleCreate() {
    const name = draft.trim();
    if (!name) return;
    try {
      // Await the enqueue so list_create precedes the place_add in the queue.
      const row = await createList.createAsync(name, 'manual');
      saveToTrip.mutate({ placeId: place.id, listId: row.id, isFirst: false, title: row.name });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility(t('trips.a11ySavedAnnounce', { name: row.name }));
      setDraft('');
      setCreating(false);
      setError(null);
    } catch (e) {
      setError(
        (e as Error & { code?: string }).code === 'LIST_CAP_REACHED'
          ? t('trips.capReachedMessage', { max: LIST_SOFT_CAP })
          : t('trips.saveError')
      );
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <Pressable style={styles.backdropPress} onPress={onClose} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} accessibilityRole="header">
                {t('trips.sheetTitle')}
              </Text>
              <Text style={styles.subtitle} numberOfLines={1}>
                {place.name_en}
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

          <ScrollView style={styles.rows} bounces={false}>
            {sorted.map((list) => {
              const isMember = listIds.includes(list.id);
              return (
                <Pressable
                  key={list.id}
                  style={styles.row}
                  onPress={() => toggle(list)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: isMember }}
                  accessibilityLabel={t(
                    isMember ? 'trips.sheetRowSaved' : 'trips.sheetRowNotSaved',
                    { name: list.name }
                  )}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {list.name}
                    </Text>
                    {list.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>{t('trips.defaultBadge')}</Text>
                      </View>
                    )}
                  </View>
                  <Ionicons
                    name={isMember ? 'checkmark-circle' : 'ellipse-outline'}
                    size={26}
                    color={isMember ? c.primary : c.textTertiary}
                  />
                </Pressable>
              );
            })}

            {/* Create new trip — inline, same interaction saves the place */}
            {creating ? (
              <View style={styles.createBox}>
                <TextInput
                  style={styles.input}
                  value={draft}
                  onChangeText={(v) => {
                    setDraft(v);
                    setError(null);
                  }}
                  placeholder={t('trips.sheetCreatePlaceholder')}
                  placeholderTextColor={c.textTertiary}
                  maxLength={LIST_NAME_MAX}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleCreate}
                  accessibilityLabel={t('trips.sheetCreatePlaceholder')}
                />
                <Text style={styles.charCount}>
                  {t('trips.nameCounter', { count: draft.length, max: LIST_NAME_MAX })}
                </Text>
                {error && (
                  <Text style={styles.error} accessibilityRole="alert">
                    {error}
                  </Text>
                )}
                <Pressable
                  style={[styles.createConfirm, !draft.trim() && styles.disabled]}
                  onPress={handleCreate}
                  disabled={!draft.trim()}
                  accessibilityRole="button"
                  accessibilityLabel={t('trips.sheetCreateAdd')}
                  accessibilityState={{ disabled: !draft.trim() }}
                >
                  <Text style={styles.createConfirmText}>{t('trips.sheetCreateAdd')}</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={[styles.row, atCap && styles.disabled]}
                onPress={() => {
                  if (atCap) {
                    setError(t('trips.capReachedMessage', { max: LIST_SOFT_CAP }));
                    return;
                  }
                  setError(null);
                  setCreating(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('trips.sheetCreateNew')}
                accessibilityState={{ disabled: atCap }}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowName, { color: c.primary }]}>
                    {t('trips.sheetCreateNew')}
                  </Text>
                </View>
                <Ionicons name="add-circle-outline" size={26} color={c.primary} />
              </Pressable>
            )}
            {!creating && error && (
              <Text style={styles.error} accessibilityRole="alert">
                {error}
              </Text>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'flex-end',
    },
    backdropPress: {
      ...StyleSheet.absoluteFillObject,
    },
    sheet: {
      backgroundColor: c.surface,
      borderTopLeftRadius: borderRadius.xl,
      borderTopRightRadius: borderRadius.xl,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      maxHeight: '75%',
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
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
    title: {
      ...typography.h3,
      color: c.textPrimary,
    },
    subtitle: {
      ...typography.bodySmall,
      color: c.textSecondary,
      marginTop: 2,
    },
    rows: {
      marginTop: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 48, // 44pt target + breathing room
      paddingVertical: spacing.xs,
      gap: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    rowText: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    rowName: {
      ...typography.body,
      color: c.textPrimary,
      flexShrink: 1,
    },
    defaultBadge: {
      backgroundColor: c.primaryLight + '22',
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    defaultBadgeText: {
      fontSize: 11,
      fontWeight: '700',
      color: c.primary,
    },
    createBox: {
      paddingVertical: spacing.sm,
    },
    input: {
      ...typography.body,
      color: c.textPrimary,
      backgroundColor: c.background,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: c.border,
    },
    charCount: {
      ...typography.caption,
      color: c.textTertiary,
      textAlign: 'right',
      marginTop: 4,
    },
    error: {
      ...typography.bodySmall,
      color: c.error,
      marginTop: spacing.xs,
    },
    createConfirm: {
      backgroundColor: c.primary,
      borderRadius: borderRadius.md,
      paddingVertical: 12,
      alignItems: 'center',
      marginTop: spacing.sm,
      minHeight: 44,
      justifyContent: 'center',
    },
    createConfirmText: {
      ...typography.label,
      color: c.textOnPrimary,
    },
    disabled: {
      opacity: 0.5,
    },
  });
