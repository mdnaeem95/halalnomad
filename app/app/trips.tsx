import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../src/hooks/useTheme';
import { AppColors } from '../src/constants/theme';
import { useAuth } from '../src/hooks/useAuth';
import {
  LIST_SOFT_CAP,
  useSavedLists,
  useSavedListCounts,
  useCreateList,
  useRenameList,
  useDeleteList,
} from '../src/hooks/useSavedLists';
import { LIST_NAME_MAX } from '../src/services/saved-lists';
import { SavedList } from '../src/types';

type Editor = { mode: 'create' } | { mode: 'rename'; list: SavedList } | null;

export default function TripsScreen() {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);
  const { user } = useAuth();

  const { data: lists, isLoading } = useSavedLists();
  const { data: counts } = useSavedListCounts();
  const createList = useCreateList();
  const renameList = useRenameList();
  const deleteList = useDeleteList();

  const placeCountFor = (id: string) => counts?.[id] ?? 0;
  const countLabel = (n: number) =>
    n === 0 ? t('trips.placeCount_zero') : t('trips.placeCount', { count: n });

  const [editor, setEditor] = useState<Editor>(null);
  const [draft, setDraft] = useState('');

  const count = lists?.length ?? 0;
  const atCap = count >= LIST_SOFT_CAP;

  function openCreate() {
    if (atCap) {
      Alert.alert(t('trips.capReachedTitle'), t('trips.capReachedMessage', { max: LIST_SOFT_CAP }));
      return;
    }
    setDraft('');
    setEditor({ mode: 'create' });
  }

  function openRename(list: SavedList) {
    setDraft(list.name);
    setEditor({ mode: 'rename', list });
  }

  function submitEditor() {
    const name = draft.trim();
    if (!name || !editor) {
      setEditor(null);
      return;
    }
    if (editor.mode === 'create') {
      try {
        createList.create(name);
      } catch (e) {
        if ((e as Error & { code?: string }).code === 'LIST_CAP_REACHED') {
          Alert.alert(t('trips.capReachedTitle'), t('trips.capReachedMessage', { max: LIST_SOFT_CAP }));
        }
      }
    } else if (editor.list.name !== name) {
      renameList.mutate({ id: editor.list.id, name });
    }
    setEditor(null);
  }

  function confirmDelete(list: SavedList) {
    const n = placeCountFor(list.id);
    const message =
      n > 0
        ? t('trips.deleteWithCount', { name: list.name, count: n })
        : t('trips.deleteMessage', { name: list.name });
    Alert.alert(t('trips.deleteTitle'), message, [
      { text: t('trips.cancel'), style: 'cancel' },
      {
        text: t('trips.delete'),
        style: 'destructive',
        onPress: () => deleteList.mutate({ id: list.id, placeCount: n }),
      },
    ]);
  }

  function onRowPress(list: SavedList) {
    router.push(`/trip/${list.id}`);
  }

  // Header "+" — only meaningful when signed in.
  const headerRight = user
    ? () => (
        <Pressable
          onPress={openCreate}
          hitSlop={12}
          accessibilityLabel={t('trips.newTrip')}
          style={styles.headerAdd}
        >
          <Ionicons name="add" size={26} color={c.textOnPrimary} />
        </Pressable>
      )
    : undefined;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerRight }} />

      {!user ? (
        <View style={styles.center}>
          <Ionicons name="bookmark-outline" size={48} color={c.primaryLight} />
          <Text style={styles.emptyTitle}>{t('trips.signedOutTitle')}</Text>
          <Text style={styles.emptySubtitle}>{t('trips.signedOutSubtitle')}</Text>
          <Pressable style={styles.primaryButton} onPress={() => router.push('/auth?mode=signin')}>
            <Text style={styles.primaryButtonText}>{t('common.signIn')}</Text>
          </Pressable>
        </View>
      ) : isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={c.primary} />
        </View>
      ) : count === 0 ? (
        <View style={styles.center}>
          <Ionicons name="map-outline" size={48} color={c.primaryLight} />
          <Text style={styles.emptyTitle}>{t('trips.emptyTitle')}</Text>
          <Text style={styles.emptySubtitle}>{t('trips.emptySubtitle')}</Text>
          <Pressable style={styles.primaryButton} onPress={openCreate}>
            <Text style={styles.primaryButtonText}>{t('trips.createFirst')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={lists ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          // v2 enables maintainVisibleContentPosition by default — which pins
          // existing rows and pushes a newly-prepended trip above the viewport.
          // We sort newest-first, so the new trip must show at the top instead.
          maintainVisibleContentPosition={{ disabled: true }}
          renderItem={({ item }) => {
            const n = placeCountFor(item.id);
            // A11y: announce name + place count + "default" where true.
            const a11yLabel = [
              item.name,
              countLabel(n),
              item.is_default ? t('trips.defaultBadge') : null,
            ]
              .filter(Boolean)
              .join(', ');
            return (
              <View style={styles.row}>
                <Pressable
                  style={styles.rowMain}
                  onPress={() => onRowPress(item)}
                  accessibilityRole="button"
                  accessibilityLabel={a11yLabel}
                >
                  <View style={styles.rowNameLine}>
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {item.is_default && (
                      <View style={styles.defaultBadge}>
                        <Text style={styles.defaultBadgeText}>{t('trips.defaultBadge')}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.rowSubtitle}>{countLabel(n)}</Text>
                </Pressable>
                <Pressable
                  onPress={() => openRename(item)}
                  hitSlop={10}
                  style={styles.rowAction}
                  accessibilityRole="button"
                  accessibilityLabel={t('trips.rename') + ' ' + item.name}
                >
                  <Ionicons name="pencil-outline" size={20} color={c.textSecondary} />
                </Pressable>
                <Pressable
                  onPress={() => confirmDelete(item)}
                  hitSlop={10}
                  style={styles.rowAction}
                  accessibilityRole="button"
                  accessibilityLabel={t('trips.delete') + ' ' + item.name}
                >
                  <Ionicons name="trash-outline" size={20} color={c.error} />
                </Pressable>
              </View>
            );
          }}
        />
      )}

      <Modal visible={editor !== null} transparent animationType="fade" onRequestClose={() => setEditor(null)}>
        <Pressable style={styles.backdrop} onPress={() => setEditor(null)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.cardTitle}>
              {editor?.mode === 'rename' ? t('trips.renameTitle') : t('trips.newTrip')}
            </Text>
            <TextInput
              style={styles.input}
              value={draft}
              onChangeText={setDraft}
              placeholder={t('trips.namePlaceholder')}
              placeholderTextColor={c.textTertiary}
              maxLength={LIST_NAME_MAX}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitEditor}
              accessibilityLabel={editor?.mode === 'rename' ? t('trips.renameTitle') : t('trips.newTrip')}
            />
            {/* Live counter — nears the DB's 80-char CHECK; input is also
                hard-capped by maxLength so a violation never reaches Postgres. */}
            <Text style={styles.counter}>
              {t('trips.nameCounter', { count: draft.length, max: LIST_NAME_MAX })}
            </Text>
            <View style={styles.cardActions}>
              <Pressable style={styles.secondaryButton} onPress={() => setEditor(null)}>
                <Text style={styles.secondaryButtonText}>{t('trips.cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, styles.modalPrimary, !draft.trim() && styles.disabled]}
                onPress={submitEditor}
                disabled={!draft.trim()}
              >
                <Text style={styles.primaryButtonText}>
                  {editor?.mode === 'rename' ? t('trips.save') : t('trips.create')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: c.background },
    // Square, centered tap target so the "+" glyph sits dead-centre inside
    // iOS 26's Liquid Glass nav-button circle.
    headerAdd: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
    emptyTitle: { fontSize: 20, fontWeight: '700', color: c.textPrimary, marginTop: 8 },
    emptySubtitle: { fontSize: 15, color: c.textSecondary, textAlign: 'center', lineHeight: 22 },
    listContent: { padding: 16 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.border,
      paddingVertical: 14,
      paddingHorizontal: 16,
      marginBottom: 10,
    },
    rowMain: { flex: 1, paddingVertical: 2 },
    rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rowName: { fontSize: 16, fontWeight: '600', color: c.textPrimary, flexShrink: 1 },
    rowSubtitle: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
    defaultBadge: {
      backgroundColor: c.primaryLight + '22',
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    defaultBadgeText: { fontSize: 11, fontWeight: '700', color: c.primary },
    // ≥44pt tap target (12 pad + 20 icon = 44) for the row action buttons.
    rowAction: { padding: 12, marginLeft: 2 },
    counter: { fontSize: 12, color: c.textTertiary, textAlign: 'right', marginTop: 6 },
    primaryButton: {
      backgroundColor: c.primary,
      paddingVertical: 12,
      paddingHorizontal: 24,
      borderRadius: 10,
      alignItems: 'center',
      marginTop: 8,
    },
    primaryButtonText: { color: c.textOnPrimary, fontSize: 16, fontWeight: '600' },
    secondaryButton: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 10, alignItems: 'center' },
    secondaryButtonText: { color: c.textSecondary, fontSize: 16, fontWeight: '600' },
    disabled: { opacity: 0.5 },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      padding: 24,
    },
    card: { backgroundColor: c.surface, borderRadius: 16, padding: 20 },
    cardTitle: { fontSize: 18, fontWeight: '700', color: c.textPrimary, marginBottom: 14 },
    input: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: c.textPrimary,
      backgroundColor: c.background,
    },
    cardActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginTop: 16, gap: 8 },
    modalPrimary: { marginTop: 0 },
  });
