import * as Sentry from '@sentry/react-native';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initSentry() {
  if (!SENTRY_DSN) {
    console.warn('Sentry DSN not configured — crash reporting disabled');
    return;
  }

  Sentry.init({
    dsn: SENTRY_DSN,

    // Performance monitoring — sample 20% of transactions in production
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,

    // Only send errors in production
    enabled: !__DEV__,

    // Attach user context (anonymous — no PII)
    beforeSend(event) {
      // Strip any PII that might leak through
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
      }
      return event;
    },
  });
}

/**
 * Set anonymous user context for Sentry events.
 * Only the user ID — no email, no name.
 */
export function setSentryUser(userId: string | null) {
  if (userId) {
    Sentry.setUser({ id: userId });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Capture a non-fatal error with context.
 */
export function captureError(error: unknown, context?: Record<string, string>) {
  if (context) {
    Sentry.setContext('extra', context);
  }
  Sentry.captureException(error);
}
