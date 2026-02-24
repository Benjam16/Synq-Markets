/**
 * Centralized error reporting utility
 * Wraps Sentry for consistent error tracking across the application
 */

export function captureError(error: Error | unknown, context?: Record<string, any>) {
  // Only import Sentry if DSN is configured
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    import('@sentry/nextjs').then((Sentry) => {
      Sentry.captureException(error, {
        contexts: {
          custom: context || {},
        },
      });
    }).catch(() => {
      // Silently fail if Sentry can't be loaded
      console.error('Error reporting failed:', error, context);
    });
  } else {
    // Fallback to console in development or if Sentry not configured
    console.error('Error (Sentry not configured):', error, context);
  }
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>) {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    import('@sentry/nextjs').then((Sentry) => {
      Sentry.captureMessage(message, {
        level: level as any,
        contexts: {
          custom: context || {},
        },
      });
    }).catch(() => {
      console.warn('Message reporting failed:', message, context);
    });
  } else {
    console.log(`[${level.toUpperCase()}]`, message, context);
  }
}

export function setUserContext(userId: string | number, email?: string, metadata?: Record<string, any>) {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    import('@sentry/nextjs').then((Sentry) => {
      Sentry.setUser({
        id: String(userId),
        email: email,
        ...metadata,
      });
    }).catch(() => {
      // Silently fail
    });
  }
}

export function clearUserContext() {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
    import('@sentry/nextjs').then((Sentry) => {
      Sentry.setUser(null);
    }).catch(() => {
      // Silently fail
    });
  }
}
