/**
 * Metrics Service
 * Provides Prometheus metrics collection for application monitoring
 */
const promClient = require('prom-client');
const promMiddleware = require('express-prometheus-middleware');
const os = require('os');

// Create a Registry to register metrics
const register = new promClient.Registry();

// Set default labels for all metrics
register.setDefaultLabels({ 
  service: 'backend-api', 
  environment: process.env.NODE_ENV || 'development' 
});

// Add default metrics (CPU, memory, etc.)
promClient.collectDefaultMetrics({ register });

// Application-specific metrics
const metrics = {
  // HTTP request metrics (handled by middleware)
  httpRequestDurationMicroseconds: new promClient.Histogram({
    name: 'app_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
  }),
  
  // Also add the standard http_request_duration_seconds for dashboard compatibility
  httpRequestDuration: new promClient.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10]
  }),
  
  // Add http_requests_total counter for dashboard compatibility
  httpRequestsTotal: new promClient.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  }),
  
  // Database metrics
  dbQueryDurationSeconds: new promClient.Histogram({
    name: 'db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation', 'model'],
    buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5]
  }),
  
  dbConnectionPoolSize: new promClient.Gauge({
    name: 'db_connection_pool_size',
    help: 'Database connection pool size',
    labelNames: ['state']
  }),
  
  // Business metrics
  activeUsers: new promClient.Gauge({
    name: 'active_users',
    help: 'Number of active users in the last 24 hours'
  }),
  
  // Also create business_metrics_active_users for dashboard compatibility
  businessMetricsActiveUsers: new promClient.Gauge({
    name: 'business_metrics_active_users',
    help: 'Number of active users in the last 24 hours',
    labelNames: ['role']
  }),
  
  totalEvents: new promClient.Gauge({
    name: 'total_events',
    help: 'Total number of events in the system'
  }),
  
  attendanceRecords: new promClient.Counter({
    name: 'attendance_records_total',
    help: 'Total number of attendance records created',
    labelNames: ['type']
  }),
  
  // Also create business_metrics_attendance_recorded_total for dashboard compatibility
  businessMetricsAttendanceRecorded: new promClient.Counter({
    name: 'business_metrics_attendance_recorded_total',
    help: 'Total number of attendance records created'
  }),
  
  // Add business_metrics_duty_sessions_created_total for dashboard compatibility
  businessMetricsDutySessions: new promClient.Counter({
    name: 'business_metrics_duty_sessions_created_total',
    help: 'Total number of duty sessions created'
  }),
  
  // Add business_metrics_leave_requests_total for dashboard compatibility
  businessMetricsLeaveRequests: new promClient.Counter({
    name: 'business_metrics_leave_requests_total',
    help: 'Total number of leave requests submitted'
  }),
  
  // Add business_metrics_events_created_total for dashboard compatibility
  businessMetricsEvents: new promClient.Counter({
    name: 'business_metrics_events_created_total',
    help: 'Total number of events created'
  }),
  
  // Socket.io metrics
  socketConnections: new promClient.Gauge({
    name: 'socket_connections_current',
    help: 'Current number of Socket.IO connections'
  }),
  
  socketMessages: new promClient.Counter({
    name: 'socket_messages_total',
    help: 'Total number of Socket.IO messages',
    labelNames: ['event']
  }),
  
  // Error metrics
  errorCount: new promClient.Counter({
    name: 'error_total',
    help: 'Total number of errors',
    labelNames: ['type', 'code']
  }),
  
  // System metrics
  systemLoad: new promClient.Gauge({
    name: 'system_load',
    help: 'System load average',
    labelNames: ['interval']
  }),
  
  memoryUsage: new promClient.Gauge({
    name: 'memory_usage_bytes',
    help: 'Memory usage in bytes',
    labelNames: ['type']
  }),
  
  // File storage metrics
  storageUsage: new promClient.Gauge({
    name: 'storage_usage_bytes',
    help: 'Storage usage in bytes',
    labelNames: ['type']
  }),
  
  // Login metrics
  loginAttempts: new promClient.Counter({
    name: 'login_attempts_total',
    help: 'Total number of login attempts',
    labelNames: ['status']
  }),
  
  // Duty session metrics
  dutySessions: new promClient.Counter({
    name: 'duty_sessions_total',
    help: 'Total number of duty sessions',
    labelNames: ['status']
  }),
  
  // Backup metrics
  backupStatus: new promClient.Gauge({
    name: 'backup_status',
    help: 'Backup status (1 = success, 0 = failure)',
    labelNames: ['type']
  }),
  
  backupDuration: new promClient.Gauge({
    name: 'backup_duration_seconds',
    help: 'Backup duration in seconds',
    labelNames: ['type']
  })
};

// Register all metrics
Object.values(metrics).forEach(metric => {
  register.registerMetric(metric);
});

/**
 * Initialize metrics collection
 * @returns {Object} Metrics objects and middleware
 */
exports.init = () => {
  // Update system metrics periodically
  setInterval(() => {
    // System load
    const load = os.loadavg();
    metrics.systemLoad.set({ interval: '1m' }, load[0]);
    metrics.systemLoad.set({ interval: '5m' }, load[1]);
    metrics.systemLoad.set({ interval: '15m' }, load[2]);
    
    // Memory usage
    const mem = process.memoryUsage();
    metrics.memoryUsage.set({ type: 'rss' }, mem.rss);
    metrics.memoryUsage.set({ type: 'heapTotal' }, mem.heapTotal);
    metrics.memoryUsage.set({ type: 'heapUsed' }, mem.heapUsed);
    metrics.memoryUsage.set({ type: 'external' }, mem.external);
  }, 15000); // Update every 15 seconds
  
  return {
    middleware: promMiddleware({
      metricsPath: '/metrics',
      collectDefaultMetrics: false, // We're collecting them ourselves
      requestDurationBuckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
      authenticate: (req) => {
        // Basic authentication for metrics endpoint
        const auth = req.get('Authorization');
        if (!process.env.MONITORING_SECRET) return true;
        if (!auth) return false;
        
        const [scheme, token] = auth.split(' ');
        return scheme === 'Bearer' && token === process.env.MONITORING_SECRET;
      }
    }),
    metrics,
    register
  };
};

/**
 * Get metrics middleware
 * @returns {Function} Express middleware
 */
exports.getMetricsMiddleware = () => {
  return (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(register.metrics());
  };
};

/**
 * Track database query
 * @param {String} operation - Query operation (select, insert, update, delete)
 * @param {String} model - Database model name
 * @param {Number} duration - Query duration in seconds
 */
exports.trackDbQuery = (operation, model, duration) => {
  metrics.dbQueryDurationSeconds.observe({ operation, model }, duration);
};

/**
 * Update database connection pool metrics
 * @param {Object} pool - Database connection pool
 */
exports.updateDbPool = (pool) => {
  if (!pool) return;
  
  metrics.dbConnectionPoolSize.set({ state: 'total' }, pool.size || 0);
  metrics.dbConnectionPoolSize.set({ state: 'available' }, pool.available || 0);
  metrics.dbConnectionPoolSize.set({ state: 'idle' }, pool.idle || 0);
  metrics.dbConnectionPoolSize.set({ state: 'used' }, (pool.size - pool.available) || 0);
};

/**
 * Track business metrics
 * @param {Object} data - Business metrics data
 */
exports.updateBusinessMetrics = (data) => {
  if (data.activeUsers !== undefined) {
    metrics.activeUsers.set(data.activeUsers);
  }
  
  if (data.totalEvents !== undefined) {
    metrics.totalEvents.set(data.totalEvents);
  }
  
  if (data.attendanceRecord) {
    metrics.attendanceRecords.inc({ type: data.attendanceRecord.type || 'standard' });
  }
  
  if (data.dutySession) {
    metrics.dutySessions.inc({ status: data.dutySession.status || 'completed' });
  }
};

/**
 * Track Socket.IO metrics
 * @param {Object} io - Socket.IO instance
 */
exports.trackSocketMetrics = (io) => {
  if (!io) return;
  
  // Update connected clients count every 15 seconds
  setInterval(() => {
    const connectedSockets = io.sockets ? io.sockets.sockets.size : 0;
    metrics.socketConnections.set(connectedSockets);
  }, 15000);
  
  // Track socket messages
  io.on('connection', (socket) => {
    // Track all incoming events
    socket.onAny((event) => {
      metrics.socketMessages.inc({ event });
    });
  });
};

/**
 * Track error
 * @param {String} type - Error type
 * @param {String} code - Error code
 */
exports.trackError = (type, code) => {
  metrics.errorCount.inc({ type: type || 'unknown', code: code || 'unknown' });
};

/**
 * Update backup metrics
 * @param {String} type - Backup type
 * @param {Boolean} success - Backup success status
 * @param {Number} duration - Backup duration in seconds
 */
exports.updateBackupMetrics = (type, success, duration) => {
  metrics.backupStatus.set({ type }, success ? 1 : 0);
  
  if (duration !== undefined) {
    metrics.backupDuration.set({ type }, duration);
  }
};

/**
 * Track storage usage
 * @param {String} type - Storage type
 * @param {Number} bytes - Storage usage in bytes
 */
exports.updateStorageUsage = (type, bytes) => {
  metrics.storageUsage.set({ type }, bytes);
};

/**
 * Track login attempt
 * @param {String} status - Login status (success, failure)
 */
exports.trackLoginAttempt = (status) => {
  metrics.loginAttempts.inc({ status: status || 'unknown' });
};