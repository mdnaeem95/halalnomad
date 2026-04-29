import { PostHog } from 'posthog-react-native';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;

/**
 * PostHog analytics instance.
 * Privacy-friendly, open-source analytics. No PII collected.
 */
export const posthog = POSTHOG_API_KEY
  ? new PostHog(POSTHOG_API_KEY, {
      host: 'https://us.i.posthog.com',
      captureAppLifecycleEvents: true,
    })
  : null;

// ============================================
// EVENT NAMES (centralized to prevent typos)
// ============================================

export const EVENTS = {
  // Discovery
  PLACE_VIEWED: 'place_viewed',
  PLACE_DIRECTIONS: 'place_directions',
  PLACE_ADDRESS_COPIED: 'place_address_copied',
  SEARCH_PERFORMED: 'search_performed',
  CUISINE_FILTER_USED: 'cuisine_filter_used',
  VIEW_MODE_CHANGED: 'view_mode_changed',

  // Contributions
  PLACE_ADDED: 'place_added',
  PLACE_VERIFIED: 'place_verified',
  PLACE_REPORTED: 'place_reported',
  REVIEW_ADDED: 'review_added',
  PHOTO_UPLOADED: 'photo_uploaded',

  // Auth — funnel
  AUTH_PROMPT_SHOWN: 'auth_prompt_shown',
  SIGN_UP_STARTED: 'sign_up_started',
  SIGN_UP_COMPLETED: 'sign_up_completed',
  SIGN_IN_COMPLETED: 'sign_in_completed',

  // Permissions — funnel
  PERMISSION_LOCATION_GRANTED: 'permission_location_granted',
  PERMISSION_LOCATION_DENIED: 'permission_location_denied',
  PERMISSION_PUSH_GRANTED: 'permission_push_granted',
  PERMISSION_PUSH_DENIED: 'permission_push_denied',

  // Premium funnel
  PAYWALL_VIEWED: 'paywall_viewed',
  PAYWALL_PURCHASE_STARTED: 'paywall_purchase_started',
  SUBSCRIPTION_PURCHASED: 'subscription_purchased',
  SUBSCRIPTION_RESTORED: 'subscription_restored',

  // Onboarding
  ONBOARDING_VIEWED: 'onboarding_viewed',
  ONBOARDING_SKIPPED_TO_DISCLAIMER: 'onboarding_skipped_to_disclaimer',
  ONBOARDING_DISCLAIMER_ACKNOWLEDGED: 'onboarding_disclaimer_acknowledged',
  ONBOARDING_COMPLETED: 'onboarding_completed',

  // Engagement
  LANGUAGE_CHANGED: 'language_changed',
  APP_RATING_PROMPTED: 'app_rating_prompted',
  APP_RATING_ACCEPTED: 'app_rating_accepted',
} as const;

/**
 * Track an analytics event with optional properties.
 * No-op if PostHog is not configured (dev without API key).
 */
export function track(event: string, properties?: Record<string, string | number | boolean>) {
  posthog?.capture(event, properties);
}

/**
 * Identify a user (anonymous — only user ID, no PII).
 */
export function identifyUser(userId: string) {
  posthog?.identify(userId);
}

/**
 * Reset identity on sign out.
 */
export function resetAnalytics() {
  posthog?.reset();
}
