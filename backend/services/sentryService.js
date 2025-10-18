/**
 * Sentry Service
 * Integrates Sentry for error tracking and performance monitoring
 */
const Sentry = require('@sentry/node');
const Tracing = require('@sentry/tracing');
const pkg = require('../package.json');

/**
 * Initialize Sentry service with environment-specific configuration
 * @param {Object} app - Express app instance
 */
exports.init = (app) => {
  if (!process.env.SENTRY_DSN) {
    console.log('Sentry DSN not provided, skipping Sentry initialization');
    return;
  }
  
  console.log(`Initializing Sentry for environment: ${process.env.NODE_ENV}`);
  
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE || `club-attendance-backend@${pkg.version}`,
    integrations: [
      // Enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // Enable Express request tracing
      new Tracing.Integrations.Express({ app }),
      // Add custom integrations
      new Sentry.Integrations.OnUncaughtException({
        onFatalError: (err) => {
          console.error('Uncaught exception:', err);
          process.exit(1);
        },
      }),
      new Sentry.Integrations.OnUnhandledRejection({ mode: 'warn' }),
    ],
    
    // Set tracing options
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    
    // Configure capture behavior
    maxBreadcrumbs: 50,
    attachStacktrace: true,
    autoSessionTracking: true,
    
    // Set error sampling rate
    sampleRate: parseFloat(process.env.SENTRY_SAMPLE_RATE || 1.0),
    
    // Configure sensitive data filtering
    beforeSend: (event) => {
      // Filter out sensitive data
      if (event.request && event.request.headers) {
        // Don't send authorization headers
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      
      // Don't send local variables for production errors
      if (process.env.NODE_ENV === 'production' && event.exception) {
        delete event.exception.values[0].stacktrace.frames.map(frame => {
          delete frame.vars;
          return frame;
        });
      }
      
      return event;
    }
  });

  // Return initialized Sentry instance
  return Sentry;
};

/**
 * Set user context for error tracking
 * @param {Object} user - User object with id, email, and role
 */
exports.setUser = (user) => {
  if (!process.env.SENTRY_DSN) return;
  
  Sentry.configureScope(scope => {
    scope.setUser({
      id: user.id,
      email: user.email,
      role: user.role
    });
  });
};

/**
 * Clear user context
 */
exports.clearUser = () => {
  if (!process.env.SENTRY_DSN) return;
  
  Sentry.configureScope(scope => {
    scope.setUser(null);
  });
};

/**
 * Add breadcrumb for user actions
 * @param {String} category - Breadcrumb category
 * @param {String} message - Breadcrumb message
 * @param {Object} data - Additional data
 * @param {String} level - Breadcrumb level (info, warning, error)
 */
exports.addBreadcrumb = (category, message, data, level = 'info') => {
  if (!process.env.SENTRY_DSN) return;
  
  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level
  });
};

/**
 * Capture exception with additional context
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
exports.captureException = (error, context = {}) => {
  if (!process.env.SENTRY_DSN) {
    console.error('Error:', error);
    return;
  }
  
  Sentry.withScope(scope => {
    // Add additional context
    Object.keys(context).forEach(key => {
      scope.setExtra(key, context[key]);
    });
    
    // Capture exception
    Sentry.captureException(error);
  });
};

/**
 * Start performance transaction
 * @param {String} name - Transaction name
 * @param {String} op - Transaction operation
 * @returns {Transaction} Sentry transaction
 */
exports.startTransaction = (name, op) => {
  if (!process.env.SENTRY_DSN) return null;
  
  return Sentry.startTransaction({
    name,
    op
  });
};

/**
 * Get Sentry handlers for Express
 * @returns {Object} Sentry handlers
 */
exports.getHandlers = () => {
  if (!process.env.SENTRY_DSN) {
    // Return dummy handlers if Sentry is not initialized
    return {
      requestHandler: (req, res, next) => next(),
      errorHandler: (err, req, res, next) => next(err),
      tracingHandler: (req, res, next) => next()
    };
  }
  
  return {
    requestHandler: Sentry.Handlers.requestHandler(),
    errorHandler: Sentry.Handlers.errorHandler(),
    tracingHandler: Sentry.Handlers.tracingHandler()
  };
};