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
import { AppColors, ColorScheme } from '../../src/constants/theme';
import { SUPPORTED_LANGUAGES, SupportedLanguage } from '../../src/i18n';
import {
  borderRadius,
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
  const styles = React.useMemo(() => createStyles(c), [c]);

  if (!user || !profile) {
    return (
      <View style={styles.centered}>
        <View style={styles.iconCircle}>
          <Ionicons name="person-outline" size={36} color={c.primaryLight} />
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
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile.display_name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.displayName}>{profile.display_name}</Text>
        <Text style={styles.email}>{profile.email}</Text>
        <TierBadge tier={profile.tier} />
      </View>

      <View style={styles.statsCard}>
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
            <Ionicons name="star" size={24} color={c.accent} />
          </View>
          <View style={styles.premiumText}>
            <Text style={styles.premiumTitle}>HalalNomad Premium</Text>
            <Text style={styles.premiumDesc}>
              Offline maps, advanced filters, trip planning & more
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={c.textTertiary} />
        </Pressable>
      )}
      {isPremium && (
        <View style={styles.premiumActiveCard}>
          <Ionicons name="star" size={20} color={c.accent} />
          <Text style={styles.premiumActiveText}>Premium Active</Text>
        </View>
      )}

      {/* Language selector */}
      <View style={styles.settingsCard}>
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
      <View style={styles.settingsCard}>
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
                  color={isActive ? c.primary : c.textTertiary}
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

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
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
    backgroundColor: c.background,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: c.primaryLight + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.h2,
    color: c.textPrimary,
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    color: c.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 24,
  },
  primaryButton: {
    backgroundColor: c.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.sm,
  },
  primaryButtonText: {
    ...typography.label,
    color: c.textOnPrimary,
    fontSize: 16,
  },
  secondaryButton: {
    borderRadius: borderRadius.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: c.primary,
  },
  secondaryButtonText: {
    ...typography.label,
    color: c.primary,
    fontSize: 16,
  },
  profileCard: {
    backgroundColor: c.surface,
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
    backgroundColor: c.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarText: {
    ...typography.h1,
    color: c.textOnPrimary,
  },
  displayName: {
    ...typography.h2,
    color: c.textPrimary,
  },
  email: {
    ...typography.bodySmall,
    color: c.textTertiary,
  },
  statsCard: {
    backgroundColor: c.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadows.md,
  },
  settingsCard: {
    backgroundColor: c.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadows.md,
  },
  sectionTitle: {
    ...typography.label,
    color: c.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  points: {
    fontSize: 48,
    fontWeight: '700',
    color: c.primary,
    marginVertical: spacing.sm,
  },
  progressSection: {
    marginBottom: spacing.md,
  },
  progressLabel: {
    ...typography.caption,
    color: c.textSecondary,
    marginBottom: spacing.xs,
  },
  progressBar: {
    height: 6,
    backgroundColor: c.divider,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: c.accent,
    borderRadius: 3,
  },
  pointsBreakdown: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  breakdownTitle: {
    ...typography.label,
    color: c.textPrimary,
    marginBottom: spacing.xs,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownLabel: {
    ...typography.bodySmall,
    color: c.textSecondary,
  },
  breakdownValue: {
    ...typography.label,
    color: c.primaryLight,
  },
  languageSection: {
    marginTop: spacing.xl,
    width: '100%',
  },
  languageTitle: {
    ...typography.label,
    color: c.textSecondary,
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
    backgroundColor: c.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: c.border,
  },
  langChipActive: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  langChipText: {
    ...typography.bodySmall,
    color: c.textSecondary,
    fontWeight: '600',
  },
  langChipTextActive: {
    color: c.textOnPrimary,
  },
  signOutButton: {
    marginTop: spacing.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  signOutText: {
    ...typography.label,
    color: c.error,
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
    color: c.primary,
    fontWeight: '600',
  },
  legalDot: {
    ...typography.caption,
    color: c.textTertiary,
  },
  themeToggle: {
    flexDirection: 'row',
    backgroundColor: c.divider,
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
    backgroundColor: c.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  themeLabel: {
    ...typography.caption,
    color: c.textTertiary,
    fontWeight: '600',
  },
  themeLabelActive: {
    color: c.primary,
  },
  premiumCard: {
    backgroundColor: c.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: c.accent + '40',
    ...shadows.md,
  },
  premiumIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: c.accent + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  premiumText: {
    flex: 1,
    gap: 2,
  },
  premiumTitle: {
    ...typography.label,
    color: c.textPrimary,
    fontSize: 15,
  },
  premiumDesc: {
    ...typography.caption,
    color: c.textSecondary,
    lineHeight: 18,
  },
  premiumActiveCard: {
    backgroundColor: c.accent + '12',
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
    color: c.accent,
  },
});
