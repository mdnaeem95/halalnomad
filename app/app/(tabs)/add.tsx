import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../src/hooks/useAuth';
import { useAddPlace } from '../../src/hooks/usePlaces';
import { useLocation } from '../../src/hooks/useLocation';
import { useTheme } from '../../src/hooks/useTheme';
import { addPlaceSchema, AddPlaceInput } from '../../src/lib/schemas';
import { CuisineType, CUISINE_LABELS, PriceRange, PRICE_LABELS } from '../../src/types';
import { AppDialog, Toast } from '../../src/components/AppDialog';
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from '../../src/constants/theme';

const CUISINE_OPTIONS = Object.entries(CUISINE_LABELS) as [CuisineType, string][];
const PRICE_OPTIONS = Object.entries(PRICE_LABELS) as [string, string][];

export default function AddPlaceScreen() {
  const { user } = useAuth();
  const { location } = useLocation();
  const { colors: c } = useTheme();
  const addPlaceMutation = useAddPlace();
  const [photos, setPhotos] = useState<string[]>([]);
  const [pinLocation, setPinLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddPlaceInput>({
    resolver: zodResolver(addPlaceSchema),
    defaultValues: {
      nameEn: '',
      nameLocal: '',
      addressEn: '',
      addressLocal: '',
      cuisineType: 'other',
      priceRange: null,
      description: '',
      hours: '',
    },
  });

  // Dialog state
  const [dialog, setDialog] = useState<{
    visible: boolean;
    variant: 'success' | 'error' | 'confirm' | 'info';
    title: string;
    message: string;
    actions?: { label: string; onPress: () => void; style?: 'primary' | 'destructive' | 'cancel' }[];
  }>({ visible: false, variant: 'info', title: '', message: '' });

  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    variant: 'success' | 'error' | 'info';
  }>({ visible: false, message: '', variant: 'success' });

  function closeDialog() {
    setDialog((d) => ({ ...d, visible: false }));
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <View style={styles.iconCircle}>
          <Ionicons name="add-circle-outline" size={36} color={colors.primaryLight} />
        </View>
        <Text style={styles.title}>Sign in to contribute</Text>
        <Text style={styles.subtitle}>
          Help fellow Muslim travellers find Halal food by adding places you discover.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => router.push('/auth')}>
          <Text style={styles.primaryButtonText}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 5,
    });

    if (!result.canceled) {
      setPhotos((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
    }
  }

  function onSubmit(data: AddPlaceInput) {
    const coords = pinLocation ?? location;
    if (!coords) {
      setDialog({
        visible: true,
        variant: 'info',
        title: 'Location needed',
        message: 'Please tap the map to place a pin at the restaurant\'s location.',
      });
      return;
    }

    addPlaceMutation.mutate(
      {
        input: {
          name_en: data.nameEn,
          name_local: data.nameLocal || undefined,
          address_en: data.addressEn,
          address_local: data.addressLocal || undefined,
          latitude: coords.latitude,
          longitude: coords.longitude,
          cuisine_type: data.cuisineType,
          price_range: data.priceRange as PriceRange | undefined,
          description: data.description || undefined,
          hours: data.hours || undefined,
        },
        userId: user!.id,
        photoUris: photos,
      },
      {
        onSuccess: () => {
          setDialog({
            visible: true,
            variant: 'success',
            title: 'Place added!',
            message: 'Thank you for contributing. You earned 50 points!',
            actions: [
              {
                label: 'Done',
                onPress: () => {
                  closeDialog();
                  reset();
                  setPhotos([]);
                  setPinLocation(null);
                },
                style: 'primary',
              },
            ],
          });
        },
        onError: () => {
          setDialog({
            visible: true,
            variant: 'error',
            title: 'Something went wrong',
            message: 'Failed to add place. Please check your connection and try again.',
          });
        },
      }
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: c.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.form}>
          <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Place Details</Text>

          <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>Name (English) *</Text>
          <Controller
            control={control}
            name="nameEn"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, { backgroundColor: c.surface, color: c.textPrimary, borderColor: c.border }, errors.nameEn && styles.inputError]}
                placeholder="e.g. Halal Kitchen"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholderTextColor={c.textTertiary}
              />
            )}
          />
          {errors.nameEn && (
            <Text style={styles.errorText}>{errors.nameEn.message}</Text>
          )}

          <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>Name (Local Language)</Text>
          <Controller
            control={control}
            name="nameLocal"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, { backgroundColor: c.surface, color: c.textPrimary, borderColor: c.border }]}
                placeholder="e.g. 清真美食"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholderTextColor={c.textTertiary}
              />
            )}
          />

          <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>Address (English) *</Text>
          <Controller
            control={control}
            name="addressEn"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, { backgroundColor: c.surface, color: c.textPrimary, borderColor: c.border }, errors.addressEn && styles.inputError]}
                placeholder="Street, City, Country"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholderTextColor={c.textTertiary}
              />
            )}
          />
          {errors.addressEn && (
            <Text style={styles.errorText}>{errors.addressEn.message}</Text>
          )}

          <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>Address (Local Language)</Text>
          <Controller
            control={control}
            name="addressLocal"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, { backgroundColor: c.surface, color: c.textPrimary, borderColor: c.border }]}
                placeholder="Local address for taxi drivers"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholderTextColor={c.textTertiary}
              />
            )}
          />

          <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Restaurant Location *</Text>
          <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>
            Tap the map to place a pin at the restaurant's location
          </Text>
          <View style={styles.mapPickerContainer}>
            <MapView
              style={styles.mapPicker}
              provider={PROVIDER_GOOGLE}
              initialRegion={
                location
                  ? {
                      ...location,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }
                  : {
                      latitude: 21.4225,
                      longitude: 39.8262,
                      latitudeDelta: 0.05,
                      longitudeDelta: 0.05,
                    }
              }
              showsUserLocation
              onPress={(e) => setPinLocation(e.nativeEvent.coordinate)}
            >
              {pinLocation && (
                <Marker
                  coordinate={pinLocation}
                  draggable
                  onDragEnd={(e) => setPinLocation(e.nativeEvent.coordinate)}
                />
              )}
            </MapView>
            {pinLocation && (
              <View style={[styles.pinConfirm, { backgroundColor: c.primary + '15' }]}>
                <Ionicons name="checkmark-circle" size={14} color={c.primary} />
                <Text style={[styles.pinConfirmText, { color: c.primary }]}>
                  Pin placed — drag to adjust
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Cuisine Type</Text>
          <Controller
            control={control}
            name="cuisineType"
            render={({ field: { onChange, value } }) => (
              <View style={styles.chipGroup}>
                {CUISINE_OPTIONS.map(([key, label]) => (
                  <Pressable
                    key={key}
                    style={[styles.chip, value === key && styles.chipActive]}
                    onPress={() => onChange(key)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        value === key && styles.chipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />

          <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Price Range</Text>
          <Controller
            control={control}
            name="priceRange"
            render={({ field: { onChange, value } }) => (
              <View style={styles.chipGroup}>
                {PRICE_OPTIONS.map(([key, label]) => (
                  <Pressable
                    key={key}
                    style={[
                      styles.chip,
                      value === Number(key) && styles.chipActive,
                    ]}
                    onPress={() => onChange(Number(key))}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        value === Number(key) && styles.chipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          />

          <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>Description</Text>
          <Controller
            control={control}
            name="description"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, styles.textArea, { backgroundColor: c.surface, color: c.textPrimary, borderColor: c.border }]}
                placeholder="What should travellers know about this place?"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                multiline
                numberOfLines={3}
                placeholderTextColor={c.textTertiary}
              />
            )}
          />
          {errors.description && (
            <Text style={styles.errorText}>{errors.description.message}</Text>
          )}

          <Text style={[styles.fieldLabel, { color: c.textSecondary }]}>Opening Hours</Text>
          <Controller
            control={control}
            name="hours"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, { backgroundColor: c.surface, color: c.textPrimary, borderColor: c.border }]}
                placeholder="e.g. Mon-Sat 11:00-22:00"
                value={value ?? ''}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholderTextColor={c.textTertiary}
              />
            )}
          />

          <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>Photos</Text>
          <Pressable style={styles.photoButton} onPress={handlePickPhoto}>
            <Ionicons name="camera-outline" size={20} color={colors.primary} />
            <Text style={styles.photoButtonText}>
              {photos.length > 0
                ? `${photos.length} photo${photos.length > 1 ? 's' : ''} selected`
                : 'Add Photos'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.primaryButton, addPlaceMutation.isPending && styles.buttonDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={addPlaceMutation.isPending}
          >
            <Text style={styles.primaryButtonText}>
              {addPlaceMutation.isPending ? 'Submitting...' : 'Add Place'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  form: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
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
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    ...typography.label,
    color: colors.textSecondary,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    ...typography.body,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputError: {
    borderColor: colors.error,
  },
  errorText: {
    ...typography.caption,
    color: colors.error,
    marginTop: 4,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  chipGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.white,
  },
  mapPickerContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  mapPicker: {
    width: '100%',
    height: 200,
  },
  pinConfirm: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: spacing.sm,
  },
  pinConfirmText: {
    ...typography.caption,
    fontWeight: '600',
  },
  photoButton: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  photoButtonText: {
    ...typography.label,
    color: colors.primary,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  primaryButtonText: {
    ...typography.label,
    color: colors.white,
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
