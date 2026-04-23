import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { usePremium } from '../src/hooks/usePremium';
import { useTheme } from '../src/hooks/useTheme';
import { AppDialog, Toast } from '../src/components/AppDialog';
import {
  borderRadius,
  shadows,
  spacing,
  typography,
} from '../src/constants/theme';

const PREMIUM_FEATURES = [
  { icon: 'download-outline' as const, key: 'offlineMaps' },
  { icon: 'options-outline' as const, key: 'advancedFilters' },
  { icon: 'list-outline' as const, key: 'tripPlanning' },
  { icon: 'eye-off-outline' as const, key: 'adFree' },
  { icon: 'headset-outline' as const, key: 'prioritySupport' },
];

export default function PaywallScreen() {
  const { packages, purchase, restore, isLoading } = usePremium();
  const { colors: c } = useTheme();
  const { t } = useTranslation();
  const [selectedPlan, setSelectedPlan] = useState(0); // 0 = yearly, 1 = monthly
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [toast, setToast] = useState({ visible: false, message: '', variant: 'success' as 'success' | 'error' | 'info' });
  const [dialog, setDialog] = useState({
    visible: false,
    variant: 'success' as 'success' | 'error',
    title: '',
    message: '',
  });

  async function handlePurchase() {
    const pkg = packages[selectedPlan];
    if (!pkg) {
      // No RevenueCat packages available — products not configured yet
      setDialog({
        visible: true,
        variant: 'error',
        title: 'Not available yet',
        message: 'Subscriptions are being set up. Please try again later.',
      });
      return;
    }
    setIsPurchasing(true);
    try {
      const success = await purchase(pkg);
      if (success) {
        setDialog({
          visible: true,
          variant: 'success',
          title: t('paywall.successTitle'),
          message: t('paywall.successMessage'),
        });
      }
    } catch {
      setDialog({
        visible: true,
        variant: 'error',
        title: t('paywall.errorTitle'),
        message: t('paywall.errorMessage'),
      });
    } finally {
      setIsPurchasing(false);
    }
  }

  async function handleRestore() {
    setIsPurchasing(true);
    const restored = await restore();
    setIsPurchasing(false);
    if (restored) {
      setToast({ visible: true, message: t('paywall.restored'), variant: 'success' });
      setTimeout(() => router.back(), 1500);
    } else {
      setToast({ visible: true, message: t('paywall.noSubscription'), variant: 'info' });
    }
  }

  // Plan display data — from RevenueCat if available, fallback otherwise
  const plans = packages.length >= 2
    ? packages.map((pkg, i) => ({
        title: pkg.product.title,
        price: pkg.product.priceString,
        desc: pkg.product.description,
        isBestValue: i === 0,
      }))
    : [
        { title: t('paywall.yearlyTitle'), price: '$29.99/yr', desc: t('paywall.yearlyDesc'), isBestValue: true },
        { title: t('paywall.monthlyTitle'), price: '$4.99/mo', desc: t('paywall.monthlyDesc'), isBestValue: false },
      ];

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: c.accent + '20' }]}>
            <Ionicons name="star" size={32} color={c.accent} />
          </View>
          <Text style={[styles.title, { color: c.textPrimary }]}>{t('paywall.title')}</Text>
          <Text style={[styles.subtitle, { color: c.textSecondary }]}>{t('paywall.subtitle')}</Text>
        </View>

        {/* Features */}
        <View style={[styles.featuresCard, { backgroundColor: c.surface }]}>
          {PREMIUM_FEATURES.map((feature) => (
            <View key={feature.key} style={styles.featureRow}>
              <View style={[styles.featureIcon, { backgroundColor: c.primary + '12' }]}>
                <Ionicons name={feature.icon} size={20} color={c.primary} />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: c.textPrimary }]}>
                  {t(`paywall.features.${feature.key}.title`)}
                </Text>
                <Text style={[styles.featureDesc, { color: c.textSecondary }]}>
                  {t(`paywall.features.${feature.key}.desc`)}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Pricing */}
        {isLoading ? (
          <ActivityIndicator color={c.primary} style={{ marginVertical: spacing.lg }} />
        ) : (
          <View style={styles.pricingSection}>
            {plans.map((plan, i) => {
              const isSelected = selectedPlan === i;
              return (
                <Pressable
                  key={i}
                  style={[
                    styles.priceCard,
                    { backgroundColor: c.surface, borderColor: isSelected ? c.primary : c.border },
                    isSelected && styles.priceCardSelected,
                  ]}
                  onPress={() => setSelectedPlan(i)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${plan.title} for ${plan.price}`}
                >
                  {plan.isBestValue && (
                    <Text style={[styles.bestValue, { backgroundColor: c.primary }]}>
                      {t('paywall.bestValue')}
                    </Text>
                  )}
                  <Text style={[styles.priceTitle, { color: c.textPrimary }]}>{plan.title}</Text>
                  <Text style={[styles.priceAmount, { color: c.primary }]}>{plan.price}</Text>
                  <Text style={[styles.priceDesc, { color: c.textTertiary }]}>{plan.desc}</Text>
                  {isSelected && (
                    <View style={[styles.selectedCheck, { backgroundColor: c.primary }]}>
                      <Ionicons name="checkmark" size={14} color={c.textOnPrimary} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Subscribe button */}
        <Pressable
          style={[styles.subscribeButton, { backgroundColor: c.primary }, isPurchasing && styles.buttonDisabled]}
          onPress={handlePurchase}
          disabled={isPurchasing}
          accessibilityRole="button"
          accessibilityLabel={t('paywall.subscribe')}
        >
          <Text style={[styles.subscribeText, { color: c.textOnPrimary }]}>
            {isPurchasing ? t('common.loading') : t('paywall.subscribe')}
          </Text>
        </Pressable>

        {/* Restore */}
        <Pressable
          style={styles.restoreButton}
          onPress={handleRestore}
          disabled={isPurchasing}
          accessibilityRole="button"
        >
          <Text style={[styles.restoreText, { color: c.primary }]}>{t('paywall.restore')}</Text>
        </Pressable>

        <Text style={[styles.legal, { color: c.textTertiary }]}>{t('paywall.legal')}</Text>

        <View style={styles.legalLinks}>
          <Pressable onPress={() => Linking.openURL('https://mdnaeem95.github.io/halalnomad/terms')}>
            <Text style={[styles.legalLink, { color: c.primary }]}>Terms of Service</Text>
          </Pressable>
          <Text style={[styles.legalDot, { color: c.textTertiary }]}>·</Text>
          <Pressable onPress={() => Linking.openURL('https://mdnaeem95.github.io/halalnomad/privacy')}>
            <Text style={[styles.legalLink, { color: c.primary }]}>Privacy Policy</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onDismiss={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
      <AppDialog
        visible={dialog.visible}
        onClose={() => { setDialog((d) => ({ ...d, visible: false })); router.back(); }}
        variant={dialog.variant}
        title={dialog.title}
        message={dialog.message}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.body,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: spacing.sm,
  },
  featuresCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadows.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    gap: 2,
  },
  featureTitle: {
    ...typography.label,
  },
  featureDesc: {
    ...typography.caption,
    lineHeight: 18,
  },
  pricingSection: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  priceCard: {
    flex: 1,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    gap: spacing.xs,
  },
  priceCardSelected: {
    ...shadows.md,
  },
  bestValue: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
  },
  priceTitle: {
    ...typography.label,
  },
  priceAmount: {
    ...typography.h2,
  },
  priceDesc: {
    ...typography.caption,
    textAlign: 'center',
  },
  selectedCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeButton: {
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  subscribeText: {
    ...typography.label,
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  restoreButton: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  restoreText: {
    ...typography.bodySmall,
    fontWeight: '600',
  },
  legal: {
    ...typography.caption,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingBottom: spacing.md,
  },
  legalLink: {
    ...typography.caption,
    fontWeight: '600',
  },
  legalDot: {
    ...typography.caption,
  },
});
