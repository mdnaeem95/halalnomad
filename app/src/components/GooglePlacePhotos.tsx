// Display-time Google Place Photos row for places with zero community
// photos. Renders only when the place has a Google place_id in sources
// and Google actually has photos — every failure mode (no key, stale
// id, quota cap hit, offline) collapses to rendering nothing, which is
// the screen's normal no-photo layout.
//
// Quota shape: the hero costs 1 media request on render; the 2 extra
// thumbnails fetch only after the user taps the hero. Attribution is
// a Google ToS requirement: author credit + "Google Maps" on every
// image, never cropped or hidden. We never label these photos with
// our own categories (no "menu", no "certificate").

import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../hooks/useTheme';
import { useGooglePhotoMeta, useGooglePhotoUri } from '../hooks/useGooglePhotos';
import { GooglePhoto, GOOGLE_PHOTO_WIDTH_PX } from '../services/google-photos';
import { AppColors, typography } from '../constants/theme';
import { Place } from '../types';

export function GooglePlacePhotos({ place }: { place: Place }) {
  const { t } = useTranslation();
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);
  const [expanded, setExpanded] = useState(false);

  const { data: photos = [] } = useGooglePhotoMeta(place);
  const hero = photos[0] ?? null;
  const { data: heroUri } = useGooglePhotoUri(
    hero?.name ?? null,
    GOOGLE_PHOTO_WIDTH_PX,
    !!hero
  );

  // Nothing renders until the hero image is actually ready — no spinner,
  // no reserved blank band, no layout jump for the no-photo majority.
  if (!hero || !heroUri) return null;

  const hasMore = photos.length > 1;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photos}>
      <PhotoFrame
        photo={hero}
        uri={heroUri}
        placeName={place.name_en}
        onPress={hasMore && !expanded ? () => setExpanded(true) : undefined}
        moreCount={hasMore && !expanded ? photos.length - 1 : 0}
        styles={styles}
        t={t}
      />
      {expanded &&
        photos
          .slice(1)
          .map((p) => (
            <LazyPhoto key={p.name} photo={p} placeName={place.name_en} styles={styles} t={t} />
          ))}
    </ScrollView>
  );
}

// Thumbnails mount only when expanded, so their media requests (1 each)
// fire on the user's tap, never speculatively. Because the user asked
// for these, the tap is acknowledged with a placeholder tile while the
// fetch is in flight; on failure the tile collapses away (the error
// state means the next visit to this place retries).
function LazyPhoto({
  photo,
  placeName,
  styles,
  t,
}: {
  photo: GooglePhoto;
  placeName: string;
  styles: Styles;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const { data: uri, isError } = useGooglePhotoUri(photo.name, GOOGLE_PHOTO_WIDTH_PX, true);
  if (isError) return null;
  if (!uri) return <View style={[styles.photoWrap, styles.photoPlaceholder]} />;
  return <PhotoFrame photo={photo} uri={uri} placeName={placeName} styles={styles} t={t} />;
}

function PhotoFrame({
  photo,
  uri,
  placeName,
  onPress,
  moreCount = 0,
  styles,
  t,
}: {
  photo: GooglePhoto;
  uri: string;
  placeName: string;
  onPress?: () => void;
  moreCount?: number;
  styles: Styles;
  t: (key: string, opts?: Record<string, unknown>) => string;
}) {
  const author = photo.authors[0] ?? null;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'imagebutton' : 'image'}
      accessibilityLabel={t('googlePhotos.a11yPhoto', { name: placeName })}
      accessibilityHint={onPress ? t('googlePhotos.a11yMoreHint') : undefined}
      style={styles.photoWrap}
    >
      <Image source={{ uri }} style={styles.photo} contentFit="cover" transition={300} />
      {/* Discoverability: without this chip nothing signals that tapping
          the hero reveals the remaining photos. */}
      {moreCount > 0 && (
        <View style={styles.moreChip} pointerEvents="none">
          <Ionicons name="images-outline" size={13} color="#FFFFFF" />
          <Text style={styles.attributionText}>+{moreCount}</Text>
        </View>
      )}
      <View style={styles.attribution} pointerEvents="box-none">
        {author?.avatarUri && (
          <Image source={{ uri: author.avatarUri }} style={styles.avatar} />
        )}
        {author &&
          (author.uri ? (
            <Pressable
              onPress={() => Linking.openURL(author.uri!)}
              hitSlop={12}
              accessibilityRole="link"
              accessibilityLabel={t('googlePhotos.a11yAuthorLink', {
                author: author.displayName,
              })}
            >
              <Text style={styles.attributionText} numberOfLines={1}>
                {author.displayName}
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.attributionText} numberOfLines={1}>
              {author.displayName}
            </Text>
          ))}
        {/* Brand attribution — required off-map, text form allowed in
            space-limited UI. Not translated. */}
        <Text style={styles.attributionText}>{author ? ' · ' : ''}Google Maps</Text>
      </View>
    </Pressable>
  );
}

type Styles = ReturnType<typeof createStyles>;

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    photos: {
      height: 220,
    },
    photoWrap: {
      width: 320,
      height: 220,
      marginEnd: 2,
    },
    photo: {
      width: '100%',
      height: '100%',
      backgroundColor: c.border,
    },
    photoPlaceholder: {
      backgroundColor: c.border,
    },
    attribution: {
      position: 'absolute',
      bottom: 0,
      start: 0,
      end: 2,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 8,
      paddingVertical: 6,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    avatar: {
      width: 16,
      height: 16,
      borderRadius: 8,
      marginEnd: 6,
    },
    moreChip: {
      position: 'absolute',
      top: 8,
      end: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    attributionText: {
      ...typography.caption,
      color: '#FFFFFF',
      maxWidth: 200,
    },
  });
