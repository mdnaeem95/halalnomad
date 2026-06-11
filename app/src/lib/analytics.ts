import { PostHog } from 'posthog-react-native';
import * as Application from 'expo-application';
import i18n from '../i18n';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;

/**
 * PostHog analytics instance.
 * Privacy-friendly, open-source analytics. No PII collected.
 */
// The PostHog project lives on EU Cloud (project 191007) and the EU API
// key in .env must hit the matching EU ingest host. The SDK's built-in
// default region is US — so an SDK upgrade, a codemod, or a re-run of the
// PostHog setup wizard could silently drop this option and route events to
// the wrong region (a bug we already shipped once: events vanished from the
// EU dashboard). POSTHOG_HOST + POSTHOG_OPTIONS are a single source of truth
// asserted in analytics-host.test.ts, which runs in CI — keep them wired
// into the constructor so the regression can't land again unnoticed.
export const POSTHOG_HOST = 'https://eu.i.posthog.com';

export const POSTHOG_OPTIONS = {
  host: POSTHOG_HOST,
  captureAppLifecycleEvents: true,
} as const;

export const posthog = POSTHOG_API_KEY
  ? new PostHog(POSTHOG_API_KEY, POSTHOG_OPTIONS)
  : null;

// App version, derived once. Mirrored in lib/session.ts (startSession also
// asserts it) — both compute it identically.
export const APP_VERSION =
  Application.nativeApplicationVersion ?? Application.nativeBuildVersion ?? 'unknown';

// Register the synchronously-available super-properties at module load,
// BEFORE React mounts and startSession() runs. captureAppLifecycleEvents
// fires "Application Opened" at SDK construction, so without this the
// cold-start lifecycle event carries no super-props. app_version + app_language
// are sync, so they land on even the first-ever cold start. The session
// counters (total_sessions / is_first_session_today / days_since_install)
// need async AsyncStorage reads and are registered in startSession(); they
// attach to "Application Opened" from persisted super-props on every launch
// after the first.
posthog?.register({
  app_version: APP_VERSION,
  app_language: i18n.language,
});

// ============================================
// EVENT NAMES (centralized to prevent typos)
// ============================================

export const EVENTS = {
  // Discovery
  PLACE_VIEWED: 'place_viewed',
  PLACE_DIRECTIONS: 'place_directions',
  PLACE_ADDRESS_COPIED: 'place_address_copied',
  PLACE_EXTERNAL_SEARCH: 'place_external_search',
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

// Property values we allow on events / person / super-properties. No PII:
// never pass email, display_name, or a raw search query as a person/super
// property (query is event-only — see search_performed).
export type AnalyticsProps = Record<string, string | number | boolean | null>;

/**
 * Track an analytics event with optional properties.
 * No-op if PostHog is not configured (dev without API key).
 */
export function track(event: string, properties?: AnalyticsProps) {
  posthog?.capture(event, properties ?? undefined);
}

/**
 * Identify a user and (optionally) set their person properties.
 *
 * distinct_id is the Supabase auth.users.id UUID (approved §8.2). When
 * called while still on the pre-auth anonymous distinct_id, PostHog
 * automatically aliases the anon id into this user — that's the identity
 * stitch. No PII in `properties`.
 */
export function identifyUser(userId: string, properties?: AnalyticsProps) {
  posthog?.identify(userId, properties ?? undefined);
}

/**
 * Explicitly alias the current (anonymous) distinct_id to the user id.
 * identify() already stitches anon -> user, so this is belt-and-braces for
 * the sign-up path where we want the mapping recorded before the first
 * identify. posthog-react-native's alias() takes a single argument (the
 * new id); it aliases the CURRENT distinct id to it.
 */
export function aliasUser(userId: string) {
  posthog?.alias(userId);
}

/**
 * Set person properties on the already-identified user without emitting a
 * domain event. posthog-react-native has no people.set(); re-calling
 * identify() with the current distinct_id sends the properties as $set.
 */
export function setPersonProperties(properties: AnalyticsProps) {
  if (!posthog) return;
  posthog.identify(posthog.getDistinctId(), properties);
}

/**
 * Register super-properties — attached to every capture (including the
 * SDK's autocaptured lifecycle events) until reset. Set once per session
 * at app-open so cohort slicing works without per-call-site changes.
 */
export function registerSuperProperties(properties: AnalyticsProps) {
  posthog?.register(properties);
}

/**
 * Reset identity on sign out.
 */
export function resetAnalytics() {
  posthog?.reset();
}
