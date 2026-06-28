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
  const createList = useCreateList();
  const renameList = useRenameList();
  const deleteList = useDeleteList();

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
    Alert.alert(
      t('trips.deleteTitle'),
      t('trips.deleteMessage', { name: list.name }),
      [
        { text: t('trips.cancel'), style: 'cancel' },
        {
          text: t('trips.delete'),
          style: 'destructive',
          onPress: () => deleteList.mutate({ id: list.id, placeCount: 0 }),
        },
      ]
    );
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
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowName} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
              <Pressable
                onPress={() => openRename(item)}
                hitSlop={8}
                style={styles.rowAction}
                accessibilityLabel={t('trips.rename')}
              >
                <Ionicons name="pencil-outline" size={20} color={c.textSecondary} />
              </Pressable>
              <Pressable
                onPress={() => confirmDelete(item)}
                hitSlop={8}
                style={styles.rowAction}
                accessibilityLabel={t('trips.delete')}
              >
                <Ionicons name="trash-outline" size={20} color={c.error} />
              </Pressable>
            </View>
          )}
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
            />
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
    rowMain: { flex: 1 },
    rowName: { fontSize: 16, fontWeight: '600', color: c.textPrimary },
    rowAction: { padding: 6, marginLeft: 4 },
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
