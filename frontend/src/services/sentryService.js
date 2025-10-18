import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/react';

/**
 * Sentry Service for error tracking and performance monitoring
 * This service integrates Sentry into the React application and provides
 * methods for tracking errors, setting user context, and adding breadcrumbs.
 */
class SentryService {
  /**
   * Initialize Sentry with the provided configuration
   * 
   * @param {Object} config - Configuration options
   * @param {string} config.dsn - Sentry DSN
   * @param {string} config.environment - Environment (production, staging, development)
   * @param {number} config.tracesSampleRate - Sample rate for performance traces (0.0 to 1.0)
   * @param {Object} config.integrations - Custom integrations
   * @param {boolean} config.enabled - Whether Sentry is enabled
   * @param {string} config.release - Release version
   */
  init(config = {}) {
    const {
      dsn = process.env.REACT_APP_SENTRY_DSN || '',
      environment = process.env.NODE_ENV || 'development',
      tracesSampleRate = 0.2,
      integrations = [],
      enabled = process.env.NODE_ENV === 'production',
      release = process.env.REACT_APP_VERSION || '1.0.0',
      history = null, // Router history object for React Router v6
    } = config;

    if (!dsn && environment === 'production') {
      console.warn('Sentry DSN not provided. Error tracking is disabled.');
      return;
    }

    // Initialize Sentry
    Sentry.init({
      dsn,
      integrations: [
        new BrowserTracing({
          // Correct way to initialize React Router V6 instrumentation
          routingInstrumentation: Sentry.reactRouterV6Instrumentation(history)
        }),
        ...integrations
      ],
      tracesSampleRate,
      environment,
      enabled,
      release,
      // Enable performance monitoring
      autoSessionTracking: true,
    });

    console.log(`Sentry initialized in ${environment} environment`);
  }

  /**
   * Set user information for better error tracking
   * 
   * @param {Object} user - User information
   * @param {string} user.id - User ID
   * @param {string} user.email - User email
   * @param {string} user.username - User username
   * @param {string} user.role - User role
   */
  setUser(user) {
    if (!user) {
      Sentry.configureScope((scope) => scope.setUser(null));
      return;
    }

    const { id, email, username, role } = user;
    
    Sentry.configureScope((scope) => {
      scope.setUser({
        id,
        email,
        username,
        role,
      });
    });
  }

  /**
   * Clear user information
   */
  clearUser() {
    Sentry.configureScope((scope) => scope.setUser(null));
  }

  /**
   * Manually capture an exception
   * 
   * @param {Error} error - Error object to capture
   * @param {Object} context - Additional context for the error
   * @returns {string} - Event ID
   */
  captureException(error, context = {}) {
    return Sentry.captureException(error, {
      extra: context,
    });
  }

  /**
   * Manually capture a message
   * 
   * @param {string} message - Message to capture
   * @param {Object} context - Additional context for the message
   * @returns {string} - Event ID
   */
  captureMessage(message, context = {}) {
    return Sentry.captureMessage(message, {
      extra: context,
    });
  }

  /**
   * Add a breadcrumb to track user actions
   * 
   * @param {Object} breadcrumb - Breadcrumb details
   * @param {string} breadcrumb.category - Category of the breadcrumb
   * @param {string} breadcrumb.message - Message for the breadcrumb
   * @param {Object} breadcrumb.data - Additional data
   * @param {string} breadcrumb.level - Level (info, warning, error)
   */
  addBreadcrumb(breadcrumb) {
    Sentry.addBreadcrumb({
      category: 'ui',
      level: 'info',
      ...breadcrumb,
    });
  }

  /**
   * Start a performance transaction
   * 
   * @param {string} name - Transaction name
   * @param {string} op - Operation type
   * @returns {Transaction} - Sentry transaction object
   */
  startTransaction(name, op = 'ui.action') {
    return Sentry.startTransaction({ name, op });
  }

  /**
   * Set a tag for the current scope
   * 
   * @param {string} key - Tag key
   * @param {string} value - Tag value
   */
  setTag(key, value) {
    Sentry.setTag(key, value);
  }

  /**
   * Get the Sentry error boundary component for wrapping React components
   * 
   * @returns {Component} - Sentry error boundary component
   */
  getErrorBoundary() {
    return Sentry.ErrorBoundary;
  }

  /**
   * Higher-order component to add Sentry error boundary to a component
   * 
   * @param {Component} component - React component to wrap
   * @param {Object} options - Error boundary options
   * @returns {Component} - Wrapped component with error boundary
   */
  withErrorBoundary(component, options = {}) {
    return Sentry.withErrorBoundary(component, {
      fallback: ({ error, componentStack, resetError }) => (
        <div className="p-4 border border-red-300 bg-red-50 rounded-md">
          <h3 className="text-lg font-medium text-red-800">Something went wrong</h3>
          <div className="mt-2 text-sm text-red-700">
            <p>We've been notified about this issue and are working on it.</p>
            <button
              onClick={resetError}
              className="mt-3 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
            >
              Try again
            </button>
          </div>
        </div>
      ),
      ...options,
    });
  }

  /**
   * Create a performance trace for monitoring a function or API call
   * 
   * @param {Function} fn - Function to trace
   * @param {string} name - Name of the trace
   * @param {string} op - Operation type
   * @returns {Function} - Wrapped function with performance tracing
   */
  traceFunction(fn, name, op = 'function') {
    return async (...args) => {
      const transaction = this.startTransaction(name, op);
      try {
        const result = await fn(...args);
        transaction.finish();
        return result;
      } catch (error) {
        transaction.finish();
        this.captureException(error, { args });
        throw error;
      }
    };
  }
}

// Create a singleton instance
const sentryService = new SentryService();

export default sentryService;