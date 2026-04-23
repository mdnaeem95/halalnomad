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
      {/* Pin head */}
      <View style={[styles.pinHead, { backgroundColor: pinColor }]}>
        {isFeatured ? (
          <Ionicons name="star" size={14} color="#FFD54F" />
        ) : (
          <Ionicons name="restaurant" size={14} color={colors.white} />
        )}
      </View>
      {/* Pin tail */}
      <View style={[styles.pinTail, { borderTopColor: pinColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: 36,
    height: 44,
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
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -2,
  },
});
