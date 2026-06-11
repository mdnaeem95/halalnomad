import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const uid = session.user.id;
        identifyUser(uid);
        analyticsAliasedFor = uid; // existing session: already the user, no anon to alias
        fetchProfile(uid, true);
        loginRevenueCat(uid);
      }
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setSentryUser(session?.user?.id ?? null);
      if (session?.user) {
        const uid = session.user.id;
        // Identity stitch: alias the pre-auth anonymous distinct_id into the
        // user exactly once (sign-in path), then identify. identify() also
        // stitches, so alias is belt-and-braces; guarded against the
        // token-refresh re-fires of onAuthStateChange.
        if (analyticsAliasedFor !== uid) {
          aliasUser(uid);
          analyticsAliasedFor = uid;
        }
        identifyUser(uid);
        fetchProfile(uid, true);
        loginRevenueCat(uid);
      } else {
        resetAnalytics();
        analyticsAliasedFor = null;
        setProfile(null);
        logoutRevenueCat();
      }
    });

    return () => subscription.unsubscribe();
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
