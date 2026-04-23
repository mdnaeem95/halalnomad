import React from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../src/hooks/useAuth';
import { usePremium } from '../../src/hooks/usePremium';
import { useTheme } from '../../src/hooks/useTheme';
import { useAppStore } from '../../src/stores/app-store';
import { TierBadge } from '../../src/components/TierBadge';
import { TIER_THRESHOLDS, ContributorTier } from '../../src/types';
import { ColorScheme } from '../../src/constants/theme';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../../src/i18n';
import {
  borderRadius,
  colors,
  shadows,
  spacing,
  typography,
} from '../../src/constants/theme';

function getNextTier(current: ContributorTier): ContributorTier | null {
  const order: ContributorTier[] = ['explorer', 'guide', 'ambassador', 'legend'];
  const idx = order.indexOf(current);
  return idx < order.length - 1 ? order[idx + 1] : null;
}

export default function ProfileScreen() {
  const { user, profile, signOut } = useAuth();
  const { t } = useTranslation();
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const { isPremium } = usePremium();
  const { colors: c, colorScheme, setColorScheme } = useTheme();

  if (!user || !profile) {
    return (
      <View style={styles.centered}>
        <View style={styles.iconCircle}>
          <Ionicons name="person-outline" size={36} color={colors.primaryLight} />
        </View>
        <Text style={styles.title}>{t('profile.joinTitle')}</Text>
        <Text style={styles.subtitle}>{t('profile.joinSubtitle')}</Text>
        <Pressable
          style={styles.primaryButton}
          onPress={() => router.push('/auth')}
          accessibilityRole="button"
          accessibilityLabel={t('common.signIn')}
        >
          <Text style={styles.primaryButtonText}>{t('common.signIn')}</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => router.push('/auth')}
          accessibilityRole="button"
          accessibilityLabel={t('common.createAccount')}
        >
          <Text style={styles.secondaryButtonText}>{t('common.createAccount')}</Text>
        </Pressable>

        {/* Language selector — always available */}
        <View style={styles.languageSection}>
          <Text style={styles.languageTitle}>Language</Text>
          <View style={styles.languageRow}>
            {(Object.entries(SUPPORTED_LANGUAGES) as [SupportedLanguage, string][]).map(
              ([code, label]) => (
                <Pressable
                  key={code}
                  style={[styles.langChip, language === code && styles.langChipActive]}
                  onPress={() => setLanguage(code)}
                  accessibilityRole="button"
                  accessibilityLabel={`Switch language to ${label}`}
                  accessibilityState={{ selected: language === code }}
                >
                  <Text
                    style={[styles.langChipText, language === code && styles.langChipTextActive]}
                  >
                    {label}
                  </Text>
                </Pressable>
              )
            )}
          </View>
        </View>
      </View>
    );
  }

  const nextTier = getNextTier(profile.tier);
  const nextThreshold = nextTier ? TIER_THRESHOLDS[nextTier] : null;
  const currentThreshold = TIER_THRESHOLDS[profile.tier];
  const progress = nextThreshold
    ? (profile.points - currentThreshold) / (nextThreshold - currentThreshold)
    : 1;

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.background }]} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.profileCard, { backgroundColor: c.surface }]}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile.display_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.displayName}>{profile.display_name}</Text>
        <Text style={styles.email}>{profile.email}</Text>
        <TierBadge tier={profile.tier} />
      </View>

      <View style={[styles.statsCard, { backgroundColor: c.surface }]}>
        <Text style={styles.sectionTitle}>{t('profile.contributorPoints')}</Text>
        <Text style={styles.points}>{profile.points}</Text>

        {nextTier && nextThreshold && (
          <View style={styles.progressSection}>
            <Text style={styles.progressLabel}>
              {t('profile.pointsToNextTier', {
                points: nextThreshold - profile.points,
                tier: t(`tiers.${nextTier}`),
              })}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(progress * 100, 100)}%` },
                ]}
              />
            </View>
          </View>
        )}

        <View style={styles.pointsBreakdown}>
          <Text style={styles.breakdownTitle}>{t('profile.howToEarn')}</Text>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{t('profile.earnAddPlace')}</Text>
            <Text style={styles.breakdownValue}>+50</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{t('profile.earnCertificate')}</Text>
            <Text style={styles.breakdownValue}>+30</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{t('profile.earnReview')}</Text>
            <Text style={styles.breakdownValue}>+20</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{t('profile.earnVerify')}</Text>
            <Text style={styles.breakdownValue}>+15</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{t('profile.earnPhoto')}</Text>
            <Text style={styles.breakdownValue}>+10</Text>
          </View>
          <View style={styles.breakdownRow}>
            <Text style={styles.breakdownLabel}>{t('profile.earnReport')}</Text>
            <Text style={styles.breakdownValue}>+10</Text>
          </View>
        </View>
      </View>

      {/* Premium upsell */}
      {!isPremium && (
        <Pressable
          style={styles.premiumCard}
          onPress={() => router.push('/paywall')}
          accessibilityRole="button"
          accessibilityLabel="Upgrade to HalalNomad Premium"
        >
          <View style={styles.premiumIcon}>
            <Ionicons name="star" size={24} color={colors.accent} />
          </View>
          <View style={styles.premiumText}>
            <Text style={styles.premiumTitle}>HalalNomad Premium</Text>
            <Text style={styles.premiumDesc}>
              Offline maps, advanced filters, trip planning & more
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
        </Pressable>
      )}
      {isPremium && (
        <View style={styles.premiumActiveCard}>
          <Ionicons name="star" size={20} color={colors.accent} />
          <Text style={styles.premiumActiveText}>Premium Active</Text>
        </View>
      )}

      {/* Language selector */}
      <View style={[styles.settingsCard, { backgroundColor: c.surface }]}>
        <Text style={styles.sectionTitle}>Language</Text>
        <View style={styles.languageRow}>
          {(Object.entries(SUPPORTED_LANGUAGES) as [SupportedLanguage, string][]).map(
            ([code, label]) => (
              <Pressable
                key={code}
                style={[styles.langChip, language === code && styles.langChipActive]}
                onPress={() => setLanguage(code)}
                accessibilityRole="button"
                accessibilityLabel={`Switch language to ${label}`}
                accessibilityState={{ selected: language === code }}
              >
                <Text
                  style={[styles.langChipText, language === code && styles.langChipTextActive]}
                >
                  {label}
                </Text>
              </Pressable>
            )
          )}
        </View>
      </View>

      {/* Theme selector */}
      <View style={[styles.settingsCard, { backgroundColor: c.surface }]}>
        <Text style={styles.sectionTitle}>Theme</Text>
        <View style={styles.themeToggle}>
          {([
            { key: 'system' as ColorScheme, label: 'System', icon: 'phone-portrait-outline' as const },
            { key: 'light' as ColorScheme, label: 'Light', icon: 'sunny-outline' as const },
            { key: 'dark' as ColorScheme, label: 'Dark', icon: 'moon-outline' as const },
          ]).map((item) => {
            const isActive = colorScheme === item.key;
            return (
              <Pressable
                key={item.key}
                style={[
                  styles.themeOption,
                  isActive && styles.themeOptionActive,
                ]}
                onPress={() => setColorScheme(item.key)}
                accessibilityRole="button"
                accessibilityLabel={`Switch to ${item.label} theme`}
                accessibilityState={{ selected: isActive }}
              >
                <Ionicons
                  name={item.icon}
                  size={18}
                  color={isActive ? colors.primary : colors.textTertiary}
                />
                <Text
                  style={[
                    styles.themeLabel,
                    isActive && styles.themeLabelActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        style={styles.signOutButton}
        onPress={signOut}
        accessibilityRole="button"
        accessibilityLabel={t('profile.signOut')}
      >
        <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
      </Pressable>

      {/* Legal links */}
      <View style={styles.legalLinks}>
        <Pressable onPress={() => Linking.openURL('https://mdnaeem95.github.io/halalnomad/terms')}>
          <Text style={styles.legalLink}>Terms of Service</Text>
        </Pressable>
        <Text style={styles.legalDot}>·</Text>
        <Pressable onPress={() => Linking.openURL('https://mdnaeem95.github.io/halalnomad/privacy')}>
          <Text style={styles.legalLink}>Privacy Policy</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    ...typography.label,
    color: colors.white,
    fontSize: 16,
  },
  secondaryButton: {
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondaryButtonText: {
    ...typography.label,
    color: colors.primary,
    fontSize: 16,
  },
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.md,
    gap: spacing.xs,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    ...typography.h1,
    color: colors.white,
  },
  displayName: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  email: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  statsCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadows.md,
  },
  settingsCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadows.md,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  points: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.primary,
    marginVertical: spacing.sm,
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  progressLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.divider,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 3,
  },
  pointsBreakdown: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  breakdownTitle: {
    ...typography.label,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  breakdownValue: {
    ...typography.label,
    color: colors.primaryLight,
  },
  languageSection: {
    marginTop: spacing.xl,
    width: '100%',
  },
  languageTitle: {
    ...typography.label,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  languageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  langChip: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  langChipText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  langChipTextActive: {
    color: colors.white,
  },
  signOutButton: {
    marginTop: spacing.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  signOutText: {
    ...typography.label,
    color: colors.error,
  },
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
  },
  legalLink: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  legalDot: {
    ...typography.caption,
    color: colors.textTertiary,
  },
  themeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.divider,
    borderRadius: borderRadius.md,
    padding: 3,
    marginTop: spacing.sm,
  },
  themeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
  },
  themeOptionActive: {
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  themeLabel: {
    ...typography.caption,
    color: colors.textTertiary,
    fontWeight: '600',
  },
  themeLabelActive: {
    color: colors.primary,
  },
  premiumCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    ...shadows.md,
  },
  premiumIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumText: {
    flex: 1,
    gap: 2,
  },
  premiumTitle: {
    ...typography.label,
    color: colors.textPrimary,
    fontSize: 15,
  },
  premiumDesc: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  premiumActiveCard: {
    backgroundColor: colors.accent + '12',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  premiumActiveText: {
    ...typography.label,
    color: colors.accent,
  },
});
