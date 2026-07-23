import React, { useState } from 'react';
import {
  AccessibilityInfo,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useLocalSearchParams, router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/hooks/useAuth';
import { useLocation } from '../../src/hooks/useLocation';
import { useTheme } from '../../src/hooks/useTheme';
import { useCooldown } from '../../src/hooks/useCooldown';
import { useAddReview, usePlace, useReviews, useUserVerifications, useVerifyPlace } from '../../src/hooks/usePlaces';
import { useListMembership, useSavedLists, useSaveToTrip } from '../../src/hooks/useSavedLists';
import { SaveToTripSheet } from '../../src/components/SaveToTripSheet';
import { getMapProvider } from '../../src/services/map';
import {
  CUISINE_LABELS,
  HALAL_LEVEL_LABELS,
  HalalLevel,
  Place,
  PLACE_TYPE_LABELS,
  PRICE_LABELS,
  SOURCE_LABELS,
} from '../../src/types';
import { GooglePlacePhotos } from '../../src/components/GooglePlacePhotos';
import { HalalBadge } from '../../src/components/HalalBadge';
import { FeaturedBadge } from '../../src/components/FeaturedBadge';
import { ReportWarning } from '../../src/components/ReportWarning';
import { ReviewModal } from '../../src/components/ReviewModal';
import { PlaceDetailSkeleton } from '../../src/components/Skeleton';
import { AppDialog, Toast } from '../../src/components/AppDialog';
import {
  AppColors,
  borderRadius,
  shadows,
  spacing,
  typography,
} from '../../src/constants/theme';
import {
  googlePlaceIdFromSources,
  useGooglePhotoMeta,
  useGooglePhotoUri,
} from '../../src/hooks/useGooglePhotos';
import { GOOGLE_PHOTO_WIDTH_PX } from '../../src/services/google-photos';
import { EVENTS, PhotoSource, track } from '../../src/lib/analytics';
import { normalizePlaceSource } from '../../src/lib/navigation';
import { useAppStore } from '../../src/stores/app-store';

// Trust-level explainer copy, surfaced inline on the "How we know" card.
// Mirrors the launch-posts trust carousel so the in-app and marketing
// language stay aligned. Dynamic for level 1 / 2 so the count reflects
// real progress toward the next tier rather than a stale "needs 3."
function trustLevelExplainer(level: HalalLevel, verificationCount: number): string {
  const count = Math.max(0, verificationCount);
  switch (level) {
    case 1: {
      const remaining = Math.max(0, 3 - count);
      if (count === 0) {
        return 'Reported by a traveller. Needs 3 community confirmations to upgrade to Community Verified.';
      }
      if (remaining === 0) {
        // Race window — trigger hasn't promoted yet but count is there.
        return 'Has 3 community confirmations — upgrading to Community Verified shortly.';
      }
      return `Confirmed by ${count} ${count === 1 ? 'traveller' : 'travellers'} so far. ${remaining} more confirmation${remaining === 1 ? '' : 's'} to upgrade to Community Verified.`;
    }
    case 2:
      return `Confirmed by ${count} ${count === 1 ? 'traveller' : 'travellers'} as Halal. Recommended to verify on arrival.`;
    case 3:
      return 'A traveller uploaded a Halal certificate or Halal-only menu photo.';
    case 4:
      return 'Certified by an official Halal authority.';
  }
}

type ExternalPlatform = 'tiktok' | 'instagram';

function formatSourceName(source: string): string {
  return SOURCE_LABELS[source] ?? source.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

// TikTok and Instagram both strip the keyword query when the OS hands
// their universal-link search URLs off to the native app — verified in
// production. The only URLs that deep-link reliably *with content
// intact* are hashtag pages. We send the user to the city's `halal<city>`
// tag (high-volume on both platforms) and copy the place name to the
// clipboard so a single paste narrows to the specific place.
function buildCityHalalTag(city: string | null, country: string | null): string {
  const base = (city ?? country ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return base ? `halal${base}` : 'halal';
}

function buildExternalSearchUrl(platform: ExternalPlatform, place: Place): string {
  const tag = buildCityHalalTag(place.city, place.country);
  return platform === 'tiktok'
    ? `https://www.tiktok.com/tag/${tag}`
    : `https://www.instagram.com/explore/tags/${tag}/`;
}

export default function PlaceDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const { t } = useTranslation();
  const { user, refreshProfile } = useAuth();
  const { location } = useLocation();
  const consumePlaceView = useAppStore((s) => s.consumePlaceView);

  const { data: place, isLoading: placeLoading } = usePlace(id);
  const { data: reviews = [] } = useReviews(id ?? '');
  const { hasConfirmed, hasFlaggedClosed, hasFlaggedNotHalal } = useUserVerifications(
    id,
    user?.id
  );
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);
  const verifyMutation = useVerifyPlace();
  const reviewMutation = useAddReview();
  const saveToTrip = useSaveToTrip();
  const { data: savedLists } = useSavedLists();
  const { count: savedTripCount } = useListMembership(place?.id);
  const isSaved = savedTripCount > 0;
  const [saveSheetVisible, setSaveSheetVisible] = useState(false);
  const { isOnCooldown: verifyOnCooldown, trigger: triggerVerify } = useCooldown(5000);
  const { isOnCooldown: reportOnCooldown, trigger: triggerReport } = useCooldown(5000);
  const [reviewModalVisible, setReviewModalVisible] = useState(false);

  // Google photo layer state — shared query keys with GooglePlacePhotos,
  // so these hooks dedupe against the component's own fetches (no extra
  // API calls). Used here only to resolve photo_source for analytics.
  const googleMeta = useGooglePhotoMeta(place);
  const heroPhotoName =
    place && place.photos.length === 0 ? googleMeta.data?.[0]?.name ?? null : null;
  const heroUriQuery = useGooglePhotoUri(heroPhotoName, GOOGLE_PHOTO_WIDTH_PX, !!heroPhotoName);

  // What photo experience did this view actually get? 'google' only once
  // the hero media URI resolved (a metadata hit whose media call fails —
  // e.g. the daily quota cap — is 'none': that's the signal we monitor
  // to know the cap started biting). null = still resolving.
  const photoSource: PhotoSource | null = React.useMemo(() => {
    if (!place) return null;
    if (place.photos.length > 0) return 'community';
    if (!googlePlaceIdFromSources(place.sources)) return 'none';
    if (googleMeta.isError || googleMeta.fetchStatus === 'paused') return 'none';
    if (!googleMeta.isSuccess) return null;
    if ((googleMeta.data?.length ?? 0) === 0) return 'none';
    if (heroUriQuery.isError || heroUriQuery.fetchStatus === 'paused') return 'none';
    if (!heroUriQuery.isSuccess) return null;
    return heroUriQuery.data ? 'google' : 'none';
  }, [
    place,
    googleMeta.isSuccess,
    googleMeta.isError,
    googleMeta.fetchStatus,
    googleMeta.data,
    heroUriQuery.isSuccess,
    heroUriQuery.isError,
    heroUriQuery.fetchStatus,
    heroUriQuery.data,
  ]);

  // place_viewed: fire once per resolved place (the ref guards against
  // background refetches re-firing). is_first_view_of_session + the
  // time-to-first-view are read from the per-session store; the timing is
  // only meaningful on the first view, so it's omitted on later views.
  // Firing waits for photo_source to resolve (typically <1s for the
  // Google layer, immediate otherwise); the unmount fallback below makes
  // sure a quick bounce still counts the view.
  const placeViewedFiredFor = React.useRef<string | null>(null);
  const firePlaceViewed = React.useCallback(
    (viewedPlace: Place, source: PhotoSource) => {
      if (placeViewedFiredFor.current === viewedPlace.id) return;
      placeViewedFiredFor.current = viewedPlace.id;
      const { isFirstOfSession, secondsSinceStart } = consumePlaceView();
      track(EVENTS.PLACE_VIEWED, {
        place_id: viewedPlace.id,
        city: viewedPlace.city ?? null,
        halal_level: viewedPlace.halal_level,
        source_screen: normalizePlaceSource(from),
        is_first_view_of_session: isFirstOfSession,
        photo_source: source,
        ...(isFirstOfSession && secondsSinceStart != null
          ? { time_to_first_view_seconds: secondsSinceStart }
          : {}),
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  React.useEffect(() => {
    if (!place || photoSource == null) return;
    firePlaceViewed(place, photoSource);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place?.id, photoSource]);

  // Unmount fallback: user left before the Google layer resolved — the
  // view still happened and they saw no photos.
  const latestPlaceRef = React.useRef<Place | null>(null);
  latestPlaceRef.current = place ?? null;
  React.useEffect(
    () => () => {
      const p = latestPlaceRef.current;
      if (p) firePlaceViewed(p, 'none');
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // One review per user per place — DB-enforced via UNIQUE(place_id, user_id).
  // Use the already-fetched review list to show the right CTA without an
  // extra round-trip.
  const userReview = user ? reviews.find((r) => r.user_id === user.id) : undefined;
  const hasReviewed = !!userReview;

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

  function handleSave() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!user || !place) {
      setDialog({
        visible: true,
        variant: 'info',
        title: t('trips.signInToSaveTitle'),
        message: t('trips.signInToSaveMessage'),
        actions: [
          { label: 'Sign In', onPress: () => { closeDialog(); router.push('/auth'); }, style: 'primary' },
          { label: 'Cancel', onPress: closeDialog, style: 'cancel' },
        ],
      });
      return;
    }
    // Wait for the trips list to resolve so we don't create a duplicate default.
    if (!saveToTrip.ready) return;
    // Wk2: with ≥1 trip, the sheet owns save AND unsave (membership toggles) —
    // it doubles as the "which trips is this in?" answer. The zero-trip
    // first-save stays silent (locked Q1): auto-create the default trip.
    if ((savedLists?.length ?? 0) > 0) {
      setSaveSheetVisible(true);
      return;
    }
    try {
      const { title } = saveToTrip.save(place);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast(t('trips.savedToast', { name: title }));
      // Announce the state change for VoiceOver users.
      AccessibilityInfo.announceForAccessibility(t('trips.a11ySavedAnnounce', { name: title }));
    } catch {
      showToast(t('trips.saveError'), 'error');
    }
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

  function handleOpenReview() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (!user || !place) {
      setDialog({
        visible: true,
        variant: 'info',
        title: 'Sign in required',
        message: 'Please sign in to write a review.',
        actions: [
          { label: 'Sign In', onPress: () => { closeDialog(); router.push('/auth'); }, style: 'primary' },
          { label: 'Cancel', onPress: closeDialog, style: 'cancel' },
        ],
      });
      return;
    }
    if (hasReviewed) return;
    setReviewModalVisible(true);
  }

  function handleSubmitReview(rating: number, text: string) {
    if (!user || !place) return;
    reviewMutation.mutate(
      { placeId: place.id, userId: user.id, rating, text },
      {
        onSuccess: () => {
          setReviewModalVisible(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          showToast('Review submitted! +20 points');
          refreshProfile();
        },
        onError: () => showToast('Could not submit review — please try again', 'error'),
      }
    );
  }

  function handleDirections() {
    if (!place) return;
    // location may be null (user denied permission, or still loading) —
    // pass it through anyway. The maps app will use device location as
    // origin when our origin is missing.
    const provider = getMapProvider('google');
    provider.openDirections(location, {
      latitude: place.latitude,
      longitude: place.longitude,
    });
    // handoff_target is always google_maps under the current single-provider
    // setup (the provider hardcodes Google; Apple Maps is only an internal
    // openURL .catch fallback we can't observe). Kept as a property so the
    // dimension is ready if/when a provider picker lands.
    track(EVENTS.PLACE_DIRECTIONS, {
      place_id: place.id,
      city: place.city ?? null,
      handoff_target: 'google_maps',
    });
  }

  async function handleCopyAddress() {
    if (!place) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const address = place.address_local
      ? `${place.address_en}\n${place.address_local}`
      : place.address_en;
    await Clipboard.setStringAsync(address);
    // One physical tap copies the combined en+local string. Per spec we
    // dual-fire (don't dedup): 'en' always, plus 'local' when a local
    // address is present — so the copy of each script is counted.
    track(EVENTS.PLACE_ADDRESS_COPIED, { place_id: place.id, address_type: 'en' });
    if (place.address_local) {
      track(EVENTS.PLACE_ADDRESS_COPIED, { place_id: place.id, address_type: 'local' });
    }
    showToast('Address copied to clipboard', 'info');
  }

  async function handleExternalSearch(platform: ExternalPlatform) {
    if (!place) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const platformName = platform === 'tiktok' ? 'TikTok' : 'Instagram';
    await Clipboard.setStringAsync(place.name_en);
    track(EVENTS.PLACE_EXTERNAL_SEARCH, { platform, place_id: place.id });

    // Confirm via dialog before navigating away. Both platforms strip
    // the query from search deep links, so the user needs to paste
    // manually — telling them that AFTER they've switched apps is too
    // late (toast already gone).
    setDialog({
      visible: true,
      variant: 'info',
      title: 'Place name copied',
      message: `"${place.name_en}" is on your clipboard. Open ${platformName} and paste it in the search bar to find this place.`,
      actions: [
        {
          label: `Open ${platformName}`,
          style: 'primary',
          onPress: () => {
            closeDialog();
            Linking.openURL(buildExternalSearchUrl(platform, place)).catch(() => {
              showToast(`Could not open ${platformName}`, 'error');
            });
          },
        },
        { label: 'Cancel', onPress: closeDialog, style: 'cancel' },
      ],
    });
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
        {/* Photos — community photos always win; the Google display-time
            layer only ever fills places with zero community photos. */}
        {place.photos.length > 0 ? (
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
        ) : (
          <GooglePlacePhotos place={place} />
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

        {/* How we know — provenance + trust transparency */}
        <View style={[styles.detailsCard, styles.howWeKnowCard, { backgroundColor: c.surface }]}>
          <View style={styles.howWeKnowHeader}>
            <Ionicons name="information-circle-outline" size={18} color={c.primary} />
            <Text style={[styles.howWeKnowTitle, { color: c.textPrimary }]}>
              How we know about this place
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: c.divider }]} />

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: c.textTertiary }]}>Source</Text>
            {place.sources && place.sources.length > 0 ? (
              place.sources.map((src, i) => (
                <Text key={`${src.source}-${i}`} style={[styles.detailValue, { color: c.textPrimary }]}>
                  Imported from {formatSourceName(src.source)} · {formatDate(src.imported_at)}
                </Text>
              ))
            ) : (
              <Text style={[styles.detailValue, { color: c.textPrimary }]}>
                Added by a HalalNomad traveller · {formatDate(place.created_at)}
              </Text>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: c.divider }]} />

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: c.textTertiary }]}>Verifications</Text>
            <Text style={[styles.detailValue, { color: c.textPrimary }]}>
              {place.verification_count === 0
                ? 'No community confirmations yet'
                : `Confirmed by ${place.verification_count} ${place.verification_count === 1 ? 'traveller' : 'travellers'}`}
              {place.last_verified_at ? ` · last on ${formatDate(place.last_verified_at)}` : ''}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: c.divider }]} />

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: c.textTertiary }]}>Trust level</Text>
            <Text style={[styles.detailValue, { color: c.textPrimary }]}>
              {HALAL_LEVEL_LABELS[place.halal_level]}
            </Text>
            <Text style={[styles.howWeKnowExplainer, { color: c.textSecondary }]}>
              {trustLevelExplainer(place.halal_level, place.verification_count)}
            </Text>
          </View>
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

          {/* Look up reviews on external platforms — travellers often
              cross-check with TikTok / Instagram before committing. We
              ride the reflex without rendering their content. */}
          <View style={styles.lookupSection}>
            <Text style={[styles.lookupHeader, { color: c.textTertiary }]}>LOOK UP REVIEWS</Text>
            <View style={styles.lookupRow}>
              <Pressable
                style={[styles.lookupButton, { backgroundColor: c.surface, borderColor: c.border }]}
                onPress={() => handleExternalSearch('tiktok')}
                accessibilityRole="button"
                accessibilityLabel={`Search ${place.name_en} on TikTok`}
              >
                <Ionicons name="logo-tiktok" size={18} color={c.textPrimary} />
                <Text style={[styles.lookupButtonText, { color: c.textPrimary }]}>TikTok</Text>
              </Pressable>
              <Pressable
                style={[styles.lookupButton, { backgroundColor: c.surface, borderColor: c.border }]}
                onPress={() => handleExternalSearch('instagram')}
                accessibilityRole="button"
                accessibilityLabel={`Search ${place.name_en} on Instagram`}
              >
                <Ionicons name="logo-instagram" size={18} color={c.textPrimary} />
                <Text style={[styles.lookupButtonText, { color: c.textPrimary }]}>Instagram</Text>
              </Pressable>
            </View>
          </View>

          {/* Save to a trip (Trip Planning M2 Wk2). Zero trips: silent
              first-save into the auto-created default. ≥1 trip: opens the
              membership-toggle sheet; the label reflects "Saved to N trips"
              and the count updates optimistically from the pairs cache. */}
          <Pressable
            style={[
              styles.saveButton,
              { backgroundColor: isSaved ? c.primaryLight + '18' : c.surface, borderColor: c.primaryLight },
              (saveToTrip.isPending || !saveToTrip.ready) && styles.buttonDisabled,
            ]}
            onPress={handleSave}
            disabled={saveToTrip.isPending || !saveToTrip.ready}
            accessibilityRole="button"
            accessibilityLabel={
              isSaved
                ? t('trips.savedToTrips', { count: savedTripCount })
                : t('trips.saveToTrip')
            }
            accessibilityHint={(savedLists?.length ?? 0) > 0 ? t('trips.a11yOpensSheet') : undefined}
            accessibilityState={{ disabled: saveToTrip.isPending || !saveToTrip.ready, selected: isSaved }}
          >
            <Ionicons
              name={isSaved ? 'bookmark' : 'bookmark-outline'}
              size={18}
              color={c.primaryLight}
            />
            <Text style={[styles.saveButtonText, { color: c.primaryLight }]}>
              {isSaved
                ? t('trips.savedToTrips', { count: savedTripCount })
                : t('trips.saveToTrip')}
            </Text>
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
          <View style={styles.reviewsHeader}>
            <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>
              Reviews ({reviews.length})
            </Text>
            <Pressable
              style={[
                styles.writeReviewButton,
                { borderColor: c.primaryLight },
                hasReviewed && styles.buttonDisabled,
              ]}
              onPress={handleOpenReview}
              disabled={hasReviewed}
              accessibilityRole="button"
              accessibilityLabel={hasReviewed ? 'You have already reviewed this place' : 'Write a review'}
              accessibilityState={{ disabled: hasReviewed }}
            >
              <Ionicons
                name={hasReviewed ? 'checkmark-circle' : 'create-outline'}
                size={16}
                color={c.primaryLight}
              />
              <Text style={[styles.writeReviewText, { color: c.primaryLight }]}>
                {hasReviewed ? 'Reviewed' : 'Write a review'}
              </Text>
            </Pressable>
          </View>
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

      <ReviewModal
        visible={reviewModalVisible}
        placeName={place.name_en}
        onClose={() => setReviewModalVisible(false)}
        onSubmit={handleSubmitReview}
        isSubmitting={reviewMutation.isPending}
      />

      <SaveToTripSheet
        visible={saveSheetVisible}
        place={place}
        onClose={() => setSaveSheetVisible(false)}
      />

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
  howWeKnowCard: {
    marginTop: spacing.md,
  },
  howWeKnowHeader: {
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  howWeKnowTitle: {
    ...typography.label,
    color: c.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  howWeKnowExplainer: {
    ...typography.bodySmall,
    color: c.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  lookupSection: {
    gap: spacing.xs,
  },
  lookupHeader: {
    ...typography.caption,
    color: c.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.xs,
  },
  lookupRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  lookupButton: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: c.border,
  },
  lookupButtonText: {
    ...typography.label,
    color: c.textPrimary,
    fontSize: 14,
    fontWeight: '600',
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
  reviewsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.h3,
    color: c.textPrimary,
  },
  writeReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
  },
  writeReviewText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 13,
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
