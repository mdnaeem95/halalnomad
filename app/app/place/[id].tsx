import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks/useAuth';
import { useLocation } from '../../src/hooks/useLocation';
import { useTheme } from '../../src/hooks/useTheme';
import { useCooldown } from '../../src/hooks/useCooldown';
import { usePlace, useReviews, useUserVerifications, useVerifyPlace } from '../../src/hooks/usePlaces';
import { getMapProvider } from '../../src/services/map';
import { CUISINE_LABELS, PRICE_LABELS, PLACE_TYPE_LABELS } from '../../src/types';
import { HalalBadge } from '../../src/components/HalalBadge';
import { FeaturedBadge } from '../../src/components/FeaturedBadge';
import { usePremiumGuard } from '../../src/components/PremiumGate';
import { ReportWarning } from '../../src/components/ReportWarning';
import { PlaceDetailSkeleton } from '../../src/components/Skeleton';
import { AppDialog, Toast } from '../../src/components/AppDialog';
import {
  AppColors,
  borderRadius,
  shadows,
  spacing,
  typography,
} from '../../src/constants/theme';

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, refreshProfile } = useAuth();
  const { location } = useLocation();

  const { data: place, isLoading: placeLoading } = usePlace(id);
  const { data: reviews = [] } = useReviews(id ?? '');
  const { hasConfirmed, hasFlaggedClosed, hasFlaggedNotHalal } = useUserVerifications(
    id,
    user?.id
  );
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);
  const { requirePremium } = usePremiumGuard();
  const verifyMutation = useVerifyPlace();
  const { isOnCooldown: verifyOnCooldown, trigger: triggerVerify } = useCooldown(5000);
  const { isOnCooldown: reportOnCooldown, trigger: triggerReport } = useCooldown(5000);

  // Dialog state
  const [dialog, setDialog] = useState<{
    visible: boolean;
    variant: 'success' | 'error' | 'confirm' | 'info';
    title: string;
    message: string;
    actions?: { label: string; onPress: () => void; style?: 'primary' | 'destructive' | 'cancel' }[];
  }>({ visible: false, variant: 'info', title: '', message: '' });

  // Toast state
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    variant: 'success' | 'error' | 'info';
  }>({ visible: false, message: '', variant: 'success' });

  function showToast(message: string, variant: 'success' | 'error' | 'info' = 'success') {
    setToast({ visible: true, message, variant });
  }

  function closeDialog() {
    setDialog((d) => ({ ...d, visible: false }));
  }

  function handleVerify() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!user || !place) {
      setDialog({
        visible: true,
        variant: 'info',
        title: 'Sign in required',
        message: 'Please sign in to verify places.',
        actions: [
          { label: 'Sign In', onPress: () => { closeDialog(); router.push('/auth'); }, style: 'primary' },
          { label: 'Cancel', onPress: closeDialog, style: 'cancel' },
        ],
      });
      return;
    }
    if (hasConfirmed) return;

    triggerVerify(() => {
      verifyMutation.mutate(
        { placeId: place.id, userId: user.id, type: 'confirm' },
        {
          onSuccess: () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            showToast('Halal status confirmed! +15 points');
            refreshProfile();
          },
          onError: () => showToast('Could not confirm — please try again', 'error'),
        }
      );
    });
  }

  function handleFlag(type: 'flag_closed' | 'flag_not_halal') {
    if (!user || !place) return;
    if (type === 'flag_closed' && hasFlaggedClosed) return;
    if (type === 'flag_not_halal' && hasFlaggedNotHalal) return;

    const label = type === 'flag_closed' ? 'closed' : 'not Halal';

    setDialog({
      visible: true,
      variant: 'confirm',
      title: `Report as ${label}?`,
      message: 'This will be reviewed by the community. Thank you for helping keep information accurate.',
      actions: [
        {
          label: 'Report',
          style: 'destructive',
          onPress: () => {
            closeDialog();
            triggerReport(() => {
              verifyMutation.mutate(
                { placeId: place.id, userId: user.id, type },
                {
                  onSuccess: () => {
                    showToast('Report submitted. +10 points');
                    refreshProfile();
                  },
                  onError: () => showToast('Failed to report', 'error'),
                }
              );
            });
          },
        },
        { label: 'Cancel', onPress: closeDialog, style: 'cancel' },
      ],
    });
  }

  function handleDirections() {
    if (!place || !location) return;
    const provider = getMapProvider('google');
    provider.openDirections(location, {
      latitude: place.latitude,
      longitude: place.longitude,
    });
  }

  async function handleCopyAddress() {
    if (!place) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const address = place.address_local
      ? `${place.address_en}\n${place.address_local}`
      : place.address_en;
    await Clipboard.setStringAsync(address);
    showToast('Address copied to clipboard', 'info');
  }

  if (placeLoading) {
    return <PlaceDetailSkeleton />;
  }

  if (!place) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Place not found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={[styles.container, { backgroundColor: c.background }]} contentContainerStyle={styles.content}>
        {/* Photos */}
        {place.photos.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photos}>
            {place.photos.map((url, i) => (
              <Image
              key={i}
              source={{ uri: url }}
              style={styles.photo}
              contentFit="cover"
              transition={300}
            />
            ))}
          </ScrollView>
        )}

        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.name, { color: c.textPrimary }]}>{place.name_en}</Text>
          {place.name_local && (
            <Text style={[styles.localName, { color: c.textSecondary }]}>{place.name_local}</Text>
          )}
          {place.is_featured && place.featured_tier && (
            <FeaturedBadge tier={place.featured_tier} />
          )}
          <HalalBadge level={place.halal_level} />
          {place.verification_count > 0 && (
            <Text style={[styles.verificationCount, { color: c.textTertiary }]}>
              {place.verification_count} {place.verification_count === 1 ? 'verification' : 'verifications'}
            </Text>
          )}
        </View>

        {/* Report warnings */}
        <ReportWarning
          closedReports={place.closed_reports}
          notHalalReports={place.not_halal_reports}
        />

        {/* Details */}
        <View style={[styles.detailsCard, { backgroundColor: c.surface }]}>
          <Pressable
            onPress={handleCopyAddress}
            style={styles.addressRow}
            accessibilityRole="button"
            accessibilityLabel={`Address: ${place.address_en}${place.address_local ? `, ${place.address_local}` : ''}. Tap to copy.`}
          >
            <View style={styles.addressContent}>
              <Text style={[styles.detailLabel, { color: c.textTertiary }]}>Address</Text>
              <Text style={[styles.detailValue, { color: c.textPrimary }]}>{place.address_en}</Text>
              {place.address_local && (
                <Text style={[styles.localAddress, { color: c.textSecondary }]}>{place.address_local}</Text>
              )}
            </View>
            <Ionicons name="copy-outline" size={18} color={c.primary} />
          </Pressable>

          <View style={[styles.divider, { backgroundColor: c.divider }]} />

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: c.textTertiary }]}>Cuisine</Text>
            <Text style={[styles.detailValue, { color: c.textPrimary }]}>{CUISINE_LABELS[place.cuisine_type]}</Text>
          </View>

          {place.place_type && place.place_type !== 'restaurant' && (
            <>
              <View style={[styles.divider, { backgroundColor: c.divider }]} />
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: c.textTertiary }]}>Type</Text>
                <Text style={[styles.detailValue, { color: c.textPrimary }]}>
                  {PLACE_TYPE_LABELS[place.place_type]}
                </Text>
              </View>
            </>
          )}

          {place.price_range && (
            <>
              <View style={[styles.divider, { backgroundColor: c.divider }]} />
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: c.textTertiary }]}>Price Range</Text>
                <Text style={[styles.detailValue, { color: c.textPrimary }]}>{PRICE_LABELS[place.price_range]}</Text>
              </View>
            </>
          )}

          {place.hours && (
            <>
              <View style={[styles.divider, { backgroundColor: c.divider }]} />
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: c.textTertiary }]}>Hours</Text>
                <Text style={[styles.detailValue, { color: c.textPrimary }]}>{place.hours}</Text>
              </View>
            </>
          )}

          {place.description && (
            <>
              <View style={[styles.divider, { backgroundColor: c.divider }]} />
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: c.textTertiary }]}>About</Text>
                <Text style={[styles.detailValue, { color: c.textPrimary }]}>{place.description}</Text>
              </View>
            </>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <Pressable
            style={styles.primaryButton}
            onPress={handleDirections}
            accessibilityRole="button"
            accessibilityLabel="Get directions to this place"
          >
            <Ionicons name="navigate-outline" size={18} color={c.textOnPrimary} />
            <Text style={styles.primaryButtonText}>Get Directions</Text>
          </Pressable>

          <Pressable
            style={[styles.saveButton, { backgroundColor: c.surface, borderColor: c.accent }]}
            onPress={() => {
              if (requirePremium()) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                showToast('Saved to list! (coming soon)', 'info');
              }
            }}
            accessibilityRole="button"
            accessibilityLabel="Save to trip list. Premium feature."
          >
            <Ionicons name="bookmark-outline" size={18} color={c.accent} />
            <Text style={[styles.saveButtonText, { color: c.accent }]}>Save to List</Text>
            <View style={[styles.premiumBadge, { backgroundColor: c.accent }]}>
              <Text style={styles.premiumBadgeText}>PRO</Text>
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.verifyButton,
              { backgroundColor: hasConfirmed ? c.primaryLight + '18' : c.surface, borderColor: c.primaryLight },
              (verifyMutation.isPending || verifyOnCooldown || hasConfirmed) && styles.buttonDisabled,
            ]}
            onPress={handleVerify}
            disabled={verifyMutation.isPending || verifyOnCooldown || hasConfirmed}
            accessibilityRole="button"
            accessibilityLabel={hasConfirmed ? 'You have already confirmed this place as Halal' : 'Confirm this place is Halal'}
            accessibilityHint={hasConfirmed ? undefined : 'Awards you 15 points'}
            accessibilityState={{ disabled: verifyMutation.isPending || verifyOnCooldown || hasConfirmed }}
          >
            <Ionicons
              name={hasConfirmed ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={18}
              color={c.primaryLight}
            />
            <Text style={styles.verifyButtonText}>
              {hasConfirmed ? 'You verified this' : 'Confirm Halal'}
            </Text>
          </Pressable>

          <View style={styles.flagRow}>
            <Pressable
              style={[
                styles.flagButton,
                { backgroundColor: c.surface, borderColor: c.border },
                (reportOnCooldown || hasFlaggedClosed) && styles.buttonDisabled,
              ]}
              onPress={() => handleFlag('flag_closed')}
              disabled={reportOnCooldown || hasFlaggedClosed}
              accessibilityRole="button"
              accessibilityLabel={hasFlaggedClosed ? 'You have already reported this place as closed' : 'Report this place as closed'}
              accessibilityState={{ disabled: reportOnCooldown || hasFlaggedClosed }}
            >
              <Text style={[styles.flagButtonText, { color: c.textSecondary }]}>
                {hasFlaggedClosed ? 'Reported Closed' : 'Report Closed'}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.flagButton,
                { backgroundColor: c.surface, borderColor: c.border },
                (reportOnCooldown || hasFlaggedNotHalal) && styles.buttonDisabled,
              ]}
              onPress={() => handleFlag('flag_not_halal')}
              disabled={reportOnCooldown || hasFlaggedNotHalal}
              accessibilityRole="button"
              accessibilityLabel={hasFlaggedNotHalal ? 'You have already reported this place as not Halal' : 'Report this place as not Halal'}
              accessibilityState={{ disabled: reportOnCooldown || hasFlaggedNotHalal }}
            >
              <Text style={[styles.flagButtonText, { color: c.textSecondary }]}>
                {hasFlaggedNotHalal ? 'Reported Not Halal' : 'Report Not Halal'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Reviews */}
        <View style={styles.reviewsSection}>
          <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>
            Reviews ({reviews.length})
          </Text>
          {reviews.length === 0 ? (
            <Text style={[styles.noReviews, { color: c.textTertiary }]}>No reviews yet. Be the first!</Text>
          ) : (
            reviews.map((review) => (
              <View key={review.id} style={[styles.reviewCard, { backgroundColor: c.surface }]}>
                <View style={styles.reviewHeader}>
                  <Text style={[styles.reviewerName, { color: c.textPrimary }]}>{review.user_display_name}</Text>
                  <Text style={styles.reviewRating}>
                    {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                  </Text>
                </View>
                <Text style={[styles.reviewText, { color: c.textSecondary }]}>{review.text}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        variant={toast.variant}
        onDismiss={() => setToast((t) => ({ ...t, visible: false }))}
      />

      <AppDialog
        visible={dialog.visible}
        onClose={closeDialog}
        variant={dialog.variant}
        title={dialog.title}
        message={dialog.message}
        actions={dialog.actions}
      />
    </View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    ...typography.body,
    color: c.textSecondary,
  },
  photos: {
    height: 220,
  },
  photo: {
    width: 320,
    height: 220,
    marginEnd: 2,
    backgroundColor: c.border,
  },
  header: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  name: {
    ...typography.h1,
    color: c.textPrimary,
  },
  localName: {
    ...typography.h3,
    color: c.textSecondary,
    fontWeight: '400',
  },
  verificationCount: {
    ...typography.caption,
    color: c.textTertiary,
    marginTop: spacing.xs,
  },
  detailsCard: {
    backgroundColor: c.surface,
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  addressRow: {
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addressContent: {
    flex: 1,
    gap: 2,
  },
  localAddress: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: 2,
  },
  detailRow: {
    padding: spacing.md,
    gap: 2,
  },
  detailLabel: {
    ...typography.caption,
    color: c.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    ...typography.body,
    color: c.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: c.divider,
    marginHorizontal: spacing.md,
  },
  actions: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  primaryButton: {
    backgroundColor: c.primary,
    borderRadius: borderRadius.md,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  primaryButtonText: {
    ...typography.label,
    color: c.textOnPrimary,
    fontSize: 16,
  },
  saveButton: {
    borderRadius: borderRadius.md,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  saveButtonText: {
    ...typography.label,
    fontSize: 16,
  },
  premiumBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  premiumBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: c.textOnPrimary,
    letterSpacing: 0.5,
  },
  verifyButton: {
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: c.primaryLight,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  verifyButtonText: {
    ...typography.label,
    color: c.primaryLight,
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  flagRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  flagButton: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.border,
  },
  flagButtonText: {
    ...typography.caption,
    color: c.textSecondary,
    fontWeight: '600',
  },
  reviewsSection: {
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: c.textPrimary,
    marginBottom: spacing.sm,
  },
  noReviews: {
    ...typography.bodySmall,
    color: c.textTertiary,
    fontStyle: 'italic',
  },
  reviewCard: {
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  reviewerName: {
    ...typography.label,
    color: c.textPrimary,
  },
  reviewRating: {
    fontSize: 14,
    color: c.accent,
  },
  reviewText: {
    ...typography.bodySmall,
    color: c.textSecondary,
    lineHeight: 20,
  },
});
