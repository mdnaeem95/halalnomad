import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { startSession } from '../lib/session';
import { UserProfile } from '../types';

// A resume counts as a new "Application Opened" only after the app has been
// backgrounded for at least this long — avoids re-registering super-props on
// a quick app-switch (e.g. opening Maps for directions and coming back).
const NEW_SESSION_AFTER_BACKGROUND_MS = 5 * 60 * 1000;

/**
 * Fires startSession() once on cold start and again on each genuine
 * resume-from-background. There is no native "Application Opened" JS hook
 * (the SDK autocaptures the lifecycle event itself); this approximates it
 * for the register()/record_session/person-property work that has to run
 * in JS.
 */
export function useSessionTracking(userId: string | null, profile: UserProfile | null) {
  const backgroundedAt = useRef<number | null>(null);
  // Hold the latest auth snapshot so the AppState listener (registered once)
  // always reads current values without re-subscribing on every change.
  const latest = useRef({ userId, profile });
  latest.current = { userId, profile };

  // Cold start: one session per mount.
  useEffect(() => {
    startSession(userId, profile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current = Date.now();
      } else if (state === 'active') {
        const since = backgroundedAt.current;
        if (since != null && Date.now() - since >= NEW_SESSION_AFTER_BACKGROUND_MS) {
          startSession(latest.current.userId, latest.current.profile);
        }
        backgroundedAt.current = null;
      }
    });
    return () => sub.remove();
  }, []);
}
