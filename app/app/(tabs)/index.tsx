import React, { useCallback, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ViewToken,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useLocation } from '../../src/hooks/useLocation';
import { useNearbyPlaces } from '../../src/hooks/usePlaces';
import { useTheme } from '../../src/hooks/useTheme';
import { useAppStore } from '../../src/stores/app-store';
import { Place } from '../../src/types';
import { PlaceCard } from '../../src/components/PlaceCard';
import { PlaceCardCompact } from '../../src/components/PlaceCardCompact';
import { MapPin } from '../../src/components/MapPin';
import { PlaceListSkeleton } from '../../src/components/Skeleton';
import { LoadingSplash } from '../../src/components/LoadingSplash';
import { BrowseView } from '../../src/components/BrowseView';
import {
  AppColors,
  borderRadius,
  HALAL_LEVEL_COLORS,
  shadows,
  spacing,
  typography,
} from '../../src/constants/theme';

export default function ExploreScreen() {
  const { location, region, isLoading: locationLoading } = useLocation();
  const { data: places = [], isLoading, refetch, isRefetching } = useNearbyPlaces(location);
  const { colors: c, halalLevelColors } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);
  const viewMode = useAppStore((s) => s.exploreViewMode);
  const setViewMode = useAppStore((s) => s.setExploreViewMode);
  const mapRef = useRef<MapView>(null);
  const hasZoomed = useRef(false);
  const [showCarousel, setShowCarousel] = useState(false);
  const CARD_WIDTH = Dimensions.get('window').width * 0.75;
  const CARD_SPACING = spacing.sm;

  // When carousel scrolls, zoom map to the visible card's place
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && mapRef.current) {
        const place = viewableItems[0].item as Place;
        mapRef.current.animateToRegion(
          {
            latitude: place.latitude,
            longitude: place.longitude,
            latitudeDelta: 0.008,
            longitudeDelta: 0.008,
          },
          400
        );
      }
    },
    []
  );

  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;

  // Fit map to pins on first data load
  if (!hasZoomed.current && places.length > 0 && mapRef.current) {
    hasZoomed.current = true;
    const coords = places.map((p) => ({
      latitude: p.latitude,
      longitude: p.longitude,
    }));
    setTimeout(() => {
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 60, right: 60, bottom: 60, left: 60 },
        animated: true,
      });
    }, 500);
  }

  const carouselRef = useRef<FlatList<Place>>(null);

  function handlePlacePress(place: Place) {
    router.push(`/place/${place.id}`);
  }

  function handleMarkerPress(place: Place) {
    if (!showCarousel) {
      setShowCarousel(true);
    }
    const index = places.findIndex((p) => p.id === place.id);
    if (index >= 0) {
      setTimeout(() => {
        carouselRef.current?.scrollToIndex({ index, animated: true });
      }, 100);
    }
  }

  function handleToggle(mode: 'map' | 'list' | 'browse') {
    Haptics.selectionAsync();
    setViewMode(mode);
  }

  // Browse view doesn't need location — let users plan trips even
  // before granting permission. Render the toggle + Browse directly.
  if (viewMode === 'browse') {
    return (
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <View style={[styles.toggleContainer, { backgroundColor: c.divider }]}>
          {([
            { key: 'map' as const, label: 'Map', icon: 'map-outline' as const },
            { key: 'list' as const, label: 'List', icon: 'list-outline' as const },
            { key: 'browse' as const, label: 'Browse', icon: 'globe-outline' as const },
          ]).map((item) => {
            const isActive = viewMode === item.key;
            return (
              <Pressable
                key={item.key}
                style={[
                  styles.toggleButton,
                  isActive && [styles.toggleActive, { backgroundColor: c.surface }],
                ]}
                onPress={() => handleToggle(item.key)}
              >
                <Ionicons name={item.icon} size={16} color={isActive ? c.primary : c.textTertiary} />
                <Text style={[styles.toggleText, { color: isActive ? c.primary : c.textTertiary }]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <BrowseView />
      </View>
    );
  }

  if (locationLoading) {
    return <LoadingSplash message="Finding your location" />;
  }

  if (isLoading && places.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: c.background }]}>
        <View style={[styles.toggleContainer, { backgroundColor: c.divider }]}>
          <View style={[styles.toggleButton, styles.toggleActive, { backgroundColor: c.surface }]}>
            <Ionicons name="map-outline" size={16} color={c.primary} />
            <Text style={[styles.toggleText, { color: c.primary }]}>Map</Text>
          </View>
          <View style={styles.toggleButton}>
            <Ionicons name="list-outline" size={16} color={c.textTertiary} />
            <Text style={[styles.toggleText, { color: c.textTertiary }]}>List</Text>
          </View>
        </View>
        <PlaceListSkeleton count={5} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      {/* View mode toggle */}
      <View style={[styles.toggleContainer, { backgroundColor: c.divider }]}>
        {([
          { key: 'map' as const, label: 'Map', icon: 'map-outline' as const },
          { key: 'list' as const, label: 'List', icon: 'list-outline' as const },
          { key: 'browse' as const, label: 'Browse', icon: 'globe-outline' as const },
        ]).map((item) => {
          const isActive = viewMode === item.key;
          return (
            <Pressable
              key={item.key}
              style={[
                styles.toggleButton,
                isActive && [styles.toggleActive, { backgroundColor: c.surface }],
              ]}
              onPress={() => handleToggle(item.key)}
            >
              <Ionicons
                name={item.icon}
                size={16}
                color={isActive ? c.primary : c.textTertiary}
              />
              <Text
                style={[
                  styles.toggleText,
                  { color: isActive ? c.primary : c.textTertiary },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {viewMode === 'map' ? (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={region}
            showsUserLocation
            showsMyLocationButton
            showsCompass
          >
            {places.map((place) => (
              <Marker
                key={place.id}
                coordinate={{
                  latitude: place.latitude,
                  longitude: place.longitude,
                }}
                anchor={{ x: 0.5, y: 1 }}
                onPress={() => handleMarkerPress(place)}
              >
                <MapPin
                  halalLevel={place.halal_level}
                  isFeatured={place.is_featured}
                />
              </Marker>
            ))}
          </MapView>

          {places.length > 0 && !showCarousel && (
            <Pressable
              style={[styles.placeCount, { backgroundColor: c.surface }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowCarousel(true); }}
            >
              <Ionicons name="restaurant-outline" size={14} color={c.primary} />
              <Text style={[styles.placeCountText, { color: c.primary }]}>
                {places.length} Halal {places.length === 1 ? 'place' : 'places'} found
              </Text>
              <Ionicons name="chevron-up" size={14} color={c.primary} />
            </Pressable>
          )}

          {showCarousel && (
            <View style={styles.carouselContainer}>
              <Pressable
                style={[styles.carouselClose, { backgroundColor: c.surface }]}
                onPress={() => setShowCarousel(false)}
              >
                <Ionicons name="chevron-down" size={16} color={c.textTertiary} />
              </Pressable>
              <FlatList
                ref={carouselRef}
                data={places}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={CARD_WIDTH + CARD_SPACING}
                decelerationRate="fast"
                contentContainerStyle={{
                  paddingHorizontal: (Dimensions.get('window').width - CARD_WIDTH) / 2,
                  gap: CARD_SPACING,
                }}
                renderItem={({ item }) => (
                  <PlaceCardCompact
                    place={item}
                    onPress={handlePlacePress}
                    width={CARD_WIDTH}
                  />
                )}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
              />
            </View>
          )}
        </View>
      ) : (
        <FlashList
          data={places}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PlaceCard place={item} onPress={handlePlacePress} distance={item.distanceLabel} />
          )}

          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={c.primary}
              colors={[c.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={[styles.emptyText, { color: c.textSecondary }]}>No Halal places found.</Text>
              <Text style={[styles.emptySubtext, { color: c.textTertiary }]}>
                Be the first to add one!
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = (c: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: c.background,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  toggleContainer: {
    flexDirection: 'row',
    margin: spacing.sm,
    backgroundColor: c.divider,
    borderRadius: borderRadius.md,
    padding: 3,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
  },
  toggleActive: {
    backgroundColor: c.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  toggleText: {
    ...typography.caption,
    color: c.textTertiary,
    fontWeight: '600',
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  placeCount: {
    position: 'absolute',
    bottom: spacing.lg,
    alignSelf: 'center',
    backgroundColor: c.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    ...shadows.md,
  },
  placeCountText: {
    ...typography.label,
    color: c.primary,
  },
  list: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  emptyText: {
    ...typography.body,
    color: c.textSecondary,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.bodySmall,
    color: c.textTertiary,
    marginTop: spacing.xs,
  },
  carouselContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: spacing.md,
  },
  carouselClose: {
    alignSelf: 'center',
    width: 36,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    ...shadows.sm,
  },
});
