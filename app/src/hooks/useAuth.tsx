import React, { createContext, useContext, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase, readPersistedSession } from '../lib/supabase';
import { setSentryUser } from '../lib/sentry';
import { aliasUser, identifyUser, registerSuperProperties, resetAnalytics, setPersonProperties } from '../lib/analytics';
import { personPropertiesFromProfile } from '../lib/session';
import { loginRevenueCat, logoutRevenueCat } from '../lib/revenue-cat';
import { ContributorTier, TIER_THRESHOLDS, UserProfile } from '../types';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

// Track which user we've already aliased this app run, so the anon -> user
// stitch fires once (onAuthStateChange also fires on token refresh, where
// re-aliasing would be wrong). identify() is idempotent so it can repeat.
let analyticsAliasedFor: string | null = null;

export function getTierForPoints(points: number): ContributorTier {
  if (points >= TIER_THRESHOLDS.legend) return 'legend';
  if (points >= TIER_THRESHOLDS.ambassador) return 'ambassador';
  if (points >= TIER_THRESHOLDS.guide) return 'guide';
  return 'explorer';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // syncAnalytics: push the loaded profile to PostHog as person properties.
  // Done when a user becomes authenticated (Task 3), NOT on every
  // refreshProfile() — those fire after each points mutation and the
  // per-app-open startSession already keeps the snapshot fresh.
  async function fetchProfile(userId: string, syncAnalytics = false) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (data && !error) {
      const loaded: UserProfile = {
        id: data.id,
        email: data.email,
        display_name: data.display_name,
        avatar_url: data.avatar_url,
        points: data.points,
        tier: getTierForPoints(data.points),
        created_at: data.created_at,
        notifications_enabled: data.notifications_enabled ?? true,
        last_active_at: data.last_active_at ?? null,
        total_verifications: data.total_verifications ?? 0,
        total_reviews: data.total_reviews ?? 0,
        total_places_added: data.total_places_added ?? 0,
        cities_contributed: data.cities_contributed ?? 0,
        total_sessions: data.total_sessions ?? 0,
        total_days_active: data.total_days_active ?? 0,
      };
      setProfile(loaded);
      if (syncAnalytics) {
        setPersonProperties(personPropertiesFromProfile(loaded));
        // Re-register the tier super-property now that the profile is loaded.
        // startSession() registers super-props at app-open, but on a fresh
        // sign-in the profile isn't loaded yet, so tier would otherwise stay
        // null for the whole session. register() merges, so this only updates
        // tier and leaves the session/app super-props intact.
        registerSuperProperties({ tier: loaded.tier });
      }
    }
  }

  useEffect(() => {
    let mounted = true;

    // Apply a session to state + downstream integrations. `initial` = the boot
    // path (existing session; don't re-alias analytics — there's no anon id to
    // stitch). Later events (sign-in) do alias exactly once.
    function handleSession(next: Session | null, initial: boolean) {
      setSession(next);
      setSentryUser(next?.user?.id ?? null);
      if (next?.user) {
        const uid = next.user.id;
        if (!initial && analyticsAliasedFor !== uid) {
          aliasUser(uid);
        }
        if (analyticsAliasedFor !== uid) analyticsAliasedFor = uid;
        identifyUser(uid);
        fetchProfile(uid, true); // network call — fails soft offline (no profile set)
        loginRevenueCat(uid);
      } else {
        resetAnalytics();
        analyticsAliasedFor = null;
        setProfile(null);
        logoutRevenueCat();
      }
    }

    // Boot: getSession() returns null offline when the token is expired (the
    // refresh can't reach the network) even though the session is still stored.
    // Fall back to the persisted session so the app stays signed in offline;
    // auto-refresh revalidates it once connectivity returns.
    (async () => {
      let { data: { session } } = await supabase.auth.getSession();
      if (!session) session = await readPersistedSession();
      if (!mounted) return;
      handleSession(session, true);
      setIsLoading(false);
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // The boot path above owns the initial state (incl. the offline fallback);
      // ignoring INITIAL_SESSION avoids its null clobbering a hydrated session.
      if (event === 'INITIAL_SESSION') return;
      handleSession(session, false);
    });

    // Supabase RN requirement: gate token auto-refresh on foreground, so it
    // resumes (and revalidates an expired token) when the app returns to the
    // foreground online — without this, returning online after an offline kill
    // wouldn't recover the session.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    if (AppState.currentState === 'active') supabase.auth.startAutoRefresh();

    return () => {
      mounted = false;
      subscription.unsubscribe();
      appState.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  async function signUp(email: string, password: string, displayName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });
    if (error) throw error;
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  }

  async function refreshProfile() {
    if (session?.user) {
      await fetchProfile(session.user.id);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        profile,
        isLoading,
        signUp,
        signIn,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
