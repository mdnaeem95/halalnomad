import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { reviewSchema } from '../lib/schemas';
import { AppColors, borderRadius, shadows, spacing, typography } from '../constants/theme';

interface Props {
  visible: boolean;
  placeName: string;
  onClose: () => void;
  onSubmit: (rating: number, text: string) => void;
  isSubmitting?: boolean;
}

export function ReviewModal({
  visible,
  placeName,
  onClose,
  onSubmit,
  isSubmitting = false,
}: Props) {
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Reset form when the modal closes so re-opens start fresh.
  useEffect(() => {
    if (!visible) {
      setRating(0);
      setText('');
      setError(null);
    }
  }, [visible]);

  function handleStarPress(value: number) {
    Haptics.selectionAsync();
    setRating(value);
    setError(null);
  }

  function handleSubmit() {
    const result = reviewSchema.safeParse({ rating, text: text.trim() });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    onSubmit(result.data.rating, result.data.text);
  }

  function handleClose() {
    if (isSubmitting) return;
    onClose();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <Pressable style={styles.backdropPress} onPress={handleClose} />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} accessibilityRole="header">Write a review</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{placeName}</Text>
            </View>
            <Pressable
              onPress={handleClose}
              disabled={isSubmitting}
              hitSlop={12}
              accessibilityLabel="Close review form"
              accessibilityRole="button"
            >
              <Ionicons name="close" size={24} color={c.textTertiary} />
            </Pressable>
          </View>

          <Text style={styles.label}>Your rating</Text>
          <View style={styles.stars} accessibilityRole="adjustable" accessibilityLabel={`Rating: ${rating} out of 5 stars`}>
            {[1, 2, 3, 4, 5].map((v) => (
              <Pressable
                key={v}
                onPress={() => handleStarPress(v)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`${v} ${v === 1 ? 'star' : 'stars'}`}
              >
                <Ionicons
                  name={v <= rating ? 'star' : 'star-outline'}
                  size={36}
                  color={c.accent}
                />
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Your review</Text>
          <TextInput
            style={styles.input}
            multiline
            maxLength={1000}
            placeholder="Was the food fully Halal? Halal-only menu, certificate visible, alcohol on premises? Helps the next traveller."
            placeholderTextColor={c.textTertiary}
            value={text}
            onChangeText={(v) => { setText(v); setError(null); }}
            editable={!isSubmitting}
            textAlignVertical="top"
            accessibilityLabel="Review text"
          />
          <Text style={styles.charCount}>{text.length}/1000</Text>

          {error && (
            <Text style={styles.error} accessibilityRole="alert">{error}</Text>
          )}

          <Pressable
            style={[styles.submit, isSubmitting && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Submit review"
            accessibilityHint="Awards 20 points"
            accessibilityState={{ disabled: isSubmitting }}
          >
            {isSubmitting ? (
              <ActivityIndicator color={c.textOnPrimary} />
            ) : (
              <Text style={styles.submitText}>Submit review</Text>
            )}
          </Pressable>
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
      marginBottom: spacing.md,
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
    label: {
      ...typography.caption,
      color: c.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
    },
    stars: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    input: {
      ...typography.body,
      color: c.textPrimary,
      backgroundColor: c.background,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      minHeight: 100,
      maxHeight: 200,
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
    submit: {
      backgroundColor: c.primary,
      borderRadius: borderRadius.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: spacing.md,
    },
    submitDisabled: {
      opacity: 0.6,
    },
    submitText: {
      ...typography.label,
      color: c.textOnPrimary,
      fontSize: 16,
    },
  });
