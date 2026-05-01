import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HalalLevel } from '../types';
import { colors } from '../constants/theme';

interface Props {
  halalLevel: HalalLevel;
  isFeatured?: boolean;
}

const LEVEL_COLORS: Record<HalalLevel, string> = {
  1: '#9E9E9E',
  2: '#43A047',
  3: '#2E7D32',
  4: '#1B5E20',
};

/**
 * Custom map marker — a styled pin with halal level color coding.
 * Featured places get a gold star accent.
 */
export function MapPin({ halalLevel, isFeatured = false }: Props) {
  const pinColor = LEVEL_COLORS[halalLevel];

  return (
    <View style={styles.container}>
      {/* Pin tail — rendered first so the head sits on top of it.
          Using a rotated square (diamond) instead of the CSS-triangle
          border trick because the latter renders unreliably on Android. */}
      <View style={[styles.pinTail, { backgroundColor: pinColor }]} />
      {/* Pin head */}
      <View style={[styles.pinHead, { backgroundColor: pinColor }]}>
        {isFeatured ? (
          <Ionicons name="star" size={14} color="#FFD54F" />
        ) : (
          <Ionicons name="restaurant" size={14} color={colors.white} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 36,
    height: 40,
  },
  pinHead: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    position: 'absolute',
    top: 0,
  },
  pinTail: {
    width: 12,
    height: 12,
    transform: [{ rotate: '45deg' }],
    position: 'absolute',
    bottom: 4,
  },
});
