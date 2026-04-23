import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppColors, borderRadius, shadows, spacing, typography } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';

type DialogVariant = 'success' | 'error' | 'confirm' | 'info';

interface DialogAction {
  label: string;
  onPress: () => void;
  style?: 'primary' | 'destructive' | 'cancel';
}

interface AppDialogProps {
  visible: boolean;
  onClose: () => void;
  variant?: DialogVariant;
  title: string;
  message?: string;
  actions?: DialogAction[];
}

function getVariantConfig(c: AppColors): Record<DialogVariant, { icon: keyof typeof Ionicons.glyphMap; color: string }> {
  return {
    success: { icon: 'checkmark-circle', color: c.success },
    error: { icon: 'alert-circle', color: c.error },
    confirm: { icon: 'help-circle', color: c.warning },
    info: { icon: 'information-circle', color: c.info },
  };
}

export function AppDialog({
  visible,
  onClose,
  variant = 'info',
  title,
  message,
  actions,
}: AppDialogProps) {
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 65,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.9);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const config = getVariantConfig(c)[variant];

  const resolvedActions: DialogAction[] = actions ?? [
    { label: 'OK', onPress: onClose, style: 'primary' },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      accessibilityViewIsModal
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.dialog,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
          accessibilityRole="alert"
          accessibilityLabel={`${title}. ${message ?? ''}`}
        >
          <View
            style={[styles.iconCircle, { backgroundColor: config.color + '15' }]}
            importantForAccessibility="no"
          >
            <Ionicons name={config.icon} size={32} color={config.color} />
          </View>

          <Text style={styles.title} accessibilityRole="header">{title}</Text>
          {message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.actions} accessibilityRole="toolbar">
            {resolvedActions.map((action, i) => (
              <Pressable
                key={i}
                style={[
                  styles.actionButton,
                  action.style === 'primary' && styles.actionPrimary,
                  action.style === 'destructive' && styles.actionDestructive,
                  action.style === 'cancel' && styles.actionCancel,
                  !action.style && styles.actionPrimary,
                ]}
                onPress={action.onPress}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <Text
                  style={[
                    styles.actionText,
                    action.style === 'primary' && styles.actionTextPrimary,
                    action.style === 'destructive' && styles.actionTextDestructive,
                    action.style === 'cancel' && styles.actionTextCancel,
                    !action.style && styles.actionTextPrimary,
                  ]}
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

/**
 * Toast-style notification that auto-dismisses.
 * Appears at the top of the screen, slides down, then back up.
 */
interface ToastProps {
  visible: boolean;
  message: string;
  variant?: 'success' | 'error' | 'info';
  onDismiss: () => void;
  duration?: number;
}

export function Toast({
  visible,
  message,
  variant = 'success',
  onDismiss,
  duration = 2500,
}: ToastProps) {
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 60,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.delay(duration),
        Animated.timing(translateY, {
          toValue: -100,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss());
    }
  }, [visible]);

  if (!visible) return null;

  const toastColors = {
    success: { bg: c.success, icon: 'checkmark-circle' as const },
    error: { bg: c.error, icon: 'alert-circle' as const },
    info: { bg: c.info, icon: 'information-circle' as const },
  };

  const config = toastColors[variant];

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: config.bg, transform: [{ translateY }] },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      accessibilityLabel={message}
    >
      <Ionicons name={config.icon} size={20} color={c.textOnPrimary} />
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  dialog: {
    backgroundColor: c.surface,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    ...shadows.lg,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h3,
    color: c.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  message: {
    ...typography.bodySmall,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionButton: {
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  actionPrimary: {
    backgroundColor: c.primary,
  },
  actionDestructive: {
    backgroundColor: c.error,
  },
  actionCancel: {
    backgroundColor: 'transparent',
  },
  actionText: {
    ...typography.label,
    fontSize: 15,
  },
  actionTextPrimary: {
    color: c.textOnPrimary,
  },
  actionTextDestructive: {
    color: c.textOnPrimary,
  },
  actionTextCancel: {
    color: c.textSecondary,
  },
  toast: {
    position: 'absolute',
    top: 60,
    left: spacing.md,
    right: spacing.md,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.md,
    zIndex: 9999,
  },
  toastText: {
    ...typography.label,
    color: c.textOnPrimary,
    flex: 1,
  },
});
