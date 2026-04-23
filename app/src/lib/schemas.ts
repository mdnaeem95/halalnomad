import { z } from 'zod';

// ============================================
// AUTH
// ============================================

export const signInSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

export const signUpSchema = z.object({
  displayName: z
    .string()
    .min(1, 'Display name is required')
    .min(2, 'Display name must be at least 2 characters')
    .max(30, 'Display name must be under 30 characters'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

// ============================================
// PLACES
// ============================================

const cuisineTypes = [
  'chinese_muslim', 'middle_eastern', 'turkish', 'indian', 'pakistani',
  'indonesian', 'malaysian', 'african', 'central_asian', 'japanese',
  'korean', 'thai', 'mediterranean', 'western', 'other',
] as const;

export const addPlaceSchema = z.object({
  nameEn: z
    .string()
    .min(1, 'Name in English is required')
    .max(100, 'Name must be under 100 characters'),
  nameLocal: z
    .string()
    .max(100, 'Name must be under 100 characters')
    .optional()
    .or(z.literal('')),
  addressEn: z
    .string()
    .min(1, 'Address in English is required')
    .max(200, 'Address must be under 200 characters'),
  addressLocal: z
    .string()
    .max(200, 'Address must be under 200 characters')
    .optional()
    .or(z.literal('')),
  cuisineType: z.enum(cuisineTypes),
  priceRange: z.number().min(1).max(4).nullable(),
  description: z
    .string()
    .max(500, 'Description must be under 500 characters')
    .optional()
    .or(z.literal('')),
  hours: z
    .string()
    .max(100, 'Hours must be under 100 characters')
    .optional()
    .or(z.literal('')),
});

export type AddPlaceInput = z.infer<typeof addPlaceSchema>;

// ============================================
// REVIEWS
// ============================================

export const reviewSchema = z.object({
  rating: z.number().min(1, 'Please select a rating').max(5),
  text: z
    .string()
    .min(1, 'Please write a review')
    .min(10, 'Review must be at least 10 characters')
    .max(1000, 'Review must be under 1000 characters'),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
