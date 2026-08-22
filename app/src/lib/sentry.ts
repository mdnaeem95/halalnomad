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

// Low-cardinality context keys that are safe + useful as SEARCHABLE Sentry
// tags — so issues group by cause (feature / screen / op) rather than by
// callsite noise (the M2-carry-in hygiene goal). Everything else (placeId,
// userId, status…) stays in `extra` context only: high-cardinality values as
// tags would explode Sentry's tag index.
const TAG_KEYS = new Set(['feature', 'screen', 'op', 'mutation', 'area', 'rpc', 'context']);

/**
 * Capture a non-fatal error with context. Grouping keys in `context` become
 * searchable tags; the full object is kept as `extra` for detail. Uses a scoped
 * capture so tags don't leak onto unrelated later events (the old
 * `setContext('extra')` was global AND unsearchable).
 */
export function captureError(error: unknown, context?: Record<string, string>) {
  Sentry.withScope((scope) => {
    if (context) {
      for (const [k, v] of Object.entries(context)) {
        if (TAG_KEYS.has(k) && v != null) scope.setTag(k, String(v));
      }
      scope.setContext('extra', context);
    }
    Sentry.captureException(error);
  });
}

/**
 * Record a benign, expected event as a breadcrumb — NOT an error. For
 * by-design flows that used to be captured as exceptions and dominated the
 * issue list (e.g. the write-queue deferring a drain until auth restores).
 */
export function breadcrumb(
  message: string,
  category = 'app',
  data?: Record<string, string>,
) {
  Sentry.addBreadcrumb({ message, category, level: 'info', data });
}
