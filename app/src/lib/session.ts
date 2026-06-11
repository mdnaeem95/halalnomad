import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { supabase } from './supabase';
import { captureError } from './sentry';
import {
  AnalyticsProps,
  APP_VERSION,
  registerSuperProperties,
  setPersonProperties,
} from './analytics';
import i18n from '../i18n';
import { useAppStore } from '../stores/app-store';
import { UserProfile } from '../types';

// AsyncStorage keys for the client-side session bookkeeping that the DB
// can't derive (session counts, first-session-today, install date fallback).
const SESSION_COUNT_KEY = 'analytics_session_count';
const LAST_SESSION_DAY_KEY = 'analytics_last_session_day'; // YYYY-MM-DD
const FIRST_OPEN_KEY = 'analytics_first_open_iso';

function todayKey(): string {
  // Local-calendar day; matches the user's notion of "today" for the
  // is_first_session_today / total_days_active semantics.
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/**
 * The person-property payload (no PII). Shared by the identify() call on
 * sign-up / sign-in and the per-session people-properties refresh, so the
 * two never drift. Contribution counters come from migration 021 columns;
 * session counters lag the DB by one open (record_session runs alongside),
 * which is acceptable for a person snapshot.
 */
export function personPropertiesFromProfile(profile: UserProfile): AnalyticsProps {
  return {
    tier: profile.tier,
    language: i18n.language,
    last_active_at: profile.last_active_at,
    total_verifications: profile.total_verifications,
    total_reviews: profile.total_reviews,
    total_places_added: profile.total_places_added,
    cities_contributed: profile.cities_contributed,
    total_sessions: profile.total_sessions,
    total_days_active: profile.total_days_active,
  };
}

async function daysSinceInstall(): Promise<number> {
  try {
    const installed = await Application.getInstallationTimeAsync();
    if (installed) {
      return Math.max(0, Math.floor((Date.now() - installed.getTime()) / 86_400_000));
    }
  } catch {
    // Fall through to the AsyncStorage fallback below.
  }
  // Fallback: remember the first time we ever ran this.
  const storedIso = await AsyncStorage.getItem(FIRST_OPEN_KEY);
  if (storedIso) {
    const first = new Date(storedIso).getTime();
    return Math.max(0, Math.floor((Date.now() - first) / 86_400_000));
  }
  await AsyncStorage.setItem(FIRST_OPEN_KEY, new Date().toISOString());
  return 0;
}

/**
 * Run once per Application Opened (cold start + each resume-from-background).
 *
 * - Registers super-properties so they ride every event (incl. autocaptured
 *   lifecycle ones) — Task 2.
 * - Records the session server-side (record_session RPC) + refreshes person
 *   properties — Task 3 — for signed-in users.
 * - Resets the in-memory first-view timer used by place_viewed.
 *
 * Best-effort: never throws into the caller. Analytics must not break boot.
 */
export async function startSession(
  userId: string | null,
  profile: UserProfile | null
): Promise<void> {
  // Reset the per-session first-view timer regardless of auth state.
  useAppStore.getState().markSessionStarted();

  try {
    const prev = Number(await AsyncStorage.getItem(SESSION_COUNT_KEY)) || 0;
    const totalSessions = prev + 1;
    await AsyncStorage.setItem(SESSION_COUNT_KEY, String(totalSessions));

    const today = todayKey();
    const lastDay = await AsyncStorage.getItem(LAST_SESSION_DAY_KEY);
    const isFirstSessionToday = lastDay !== today;
    if (isFirstSessionToday) {
      await AsyncStorage.setItem(LAST_SESSION_DAY_KEY, today);
    }

    const days = await daysSinceInstall();

    registerSuperProperties({
      app_language: i18n.language,
      tier: profile?.tier ?? null,
      total_sessions: totalSessions,
      is_first_session_today: isFirstSessionToday,
      days_since_install: days,
      app_version: APP_VERSION,
    });
  } catch (err) {
    captureError(err, { context: 'startSession.superProperties' });
  }

  if (!userId) return;

  // Bump the server-side session counters (migration 021). Best-effort.
  const { error } = await supabase.rpc('record_session', { p_user_id: userId });
  if (error) captureError(error, { rpc: 'record_session' });

  // De-duped per session by virtue of startSession itself running once per
  // Application Opened. Uses the cached profile snapshot.
  if (profile) setPersonProperties(personPropertiesFromProfile(profile));
}
