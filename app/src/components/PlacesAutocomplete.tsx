import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { useLocation } from '../hooks/useLocation';
import {
  PlaceDetails,
  PlaceSuggestion,
  generateSessionToken,
  getPlaceDetails,
  searchPlaces,
} from '../services/google-places';
import {
  AppColors,
  borderRadius,
  shadows,
  spacing,
  typography,
} from '../constants/theme';

interface Props {
  onPlaceSelected: (details: PlaceDetails) => void;
}

export function PlacesAutocomplete({ onPlaceSelected }: Props) {
  const { colors: c } = useTheme();
  const styles = React.useMemo(() => createStyles(c), [c]);
  const { location } = useLocation();
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState(false);
  const sessionTokenRef = useRef<string>(generateSessionToken());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchPlaces(query, location, sessionTokenRef.current);
      setSuggestions(results);
      setSearching(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, location]);

  async function handleSelect(suggestion: PlaceSuggestion) {
    setPicking(true);
    const details = await getPlaceDetails(suggestion.placeId, sessionTokenRef.current);
    setPicking(false);
    if (details) {
      onPlaceSelected(details);
      setQuery(suggestion.mainText);
      setSuggestions([]);
      // A details fetch closes the session; the next typing cycle gets a
      // fresh token so we don't accidentally re-bill the same session.
      sessionTokenRef.current = generateSessionToken();
    }
  }

  function handleClear() {
    setQuery('');
    setSuggestions([]);
  }

  const showDropdown = suggestions.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.inputRow}>
        <Ionicons name="search" size={18} color={c.textTertiary} />
        <TextInput
          style={styles.input}
          placeholder="Search for a place (powered by Google)"
          placeholderTextColor={c.textTertiary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="search"
        />
        {searching || picking ? (
          <ActivityIndicator size="small" color={c.primary} />
        ) : query.length > 0 ? (
          <Pressable onPress={handleClear} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={c.textTertiary} />
          </Pressable>
        ) : null}
      </View>

      {showDropdown && (
        <View style={styles.dropdown}>
          {suggestions.map((s, i) => (
            <Pressable
              key={s.placeId}
              style={[
                styles.suggestionRow,
                i < suggestions.length - 1 && styles.suggestionRowBorder,
              ]}
              onPress={() => handleSelect(s)}
              disabled={picking}
            >
              <Ionicons name="location-outline" size={16} color={c.textTertiary} />
              <View style={styles.suggestionText}>
                <Text style={styles.suggestionMain} numberOfLines={1}>
                  {s.mainText}
                </Text>
                {s.secondaryText ? (
                  <Text style={styles.suggestionSecondary} numberOfLines={1}>
                    {s.secondaryText}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const createStyles = (c: AppColors) =>
  StyleSheet.create({
    container: {
      width: '100%',
      gap: spacing.xs,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
    },
    input: {
      flex: 1,
      ...typography.body,
      color: c.textPrimary,
    },
    dropdown: {
      backgroundColor: c.surface,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: c.border,
      overflow: 'hidden',
      ...shadows.sm,
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      gap: spacing.sm,
    },
    suggestionRowBorder: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.divider,
    },
    suggestionText: {
      flex: 1,
    },
    suggestionMain: {
      ...typography.body,
      color: c.textPrimary,
      fontWeight: '600',
    },
    suggestionSecondary: {
      ...typography.caption,
      color: c.textSecondary,
      marginTop: 2,
    },
  });
