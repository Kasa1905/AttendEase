/**
 * Health Controller
 * Provides comprehensive health check endpoints for monitoring
 */
const { Op } = require('sequelize');
const { sequelize, User } = require('../models');
const os = require('os');
const fs = require('fs');
const systeminformation = require('systeminformation');
const Redis = require('ioredis');
const nodemailer = require('nodemailer');

// Create Redis client if URL is defined
let redisClient;
try {
  if (process.env.REDIS_URL) {
    redisClient = new Redis(process.env.REDIS_URL);
  }
} catch (error) {
  console.error('Redis connection error:', error);
}

// Health check timeouts
const HEALTH_CHECK_TIMEOUT = parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000;

// Cache health check results for performance
const healthCache = {
  timestamp: 0,
  data: null,
  ttl: 30000 // 30 seconds cache TTL
};

/**
 * Basic health check for load balancers and simple monitoring
 * @public
 */
exports.getHealthStatus = async (req, res) => {
  try {
    const currentTime = new Date();
    return res.status(200).json({
      status: 'ok',
      time: currentTime,
      timestamp: currentTime,
      uptime: process.uptime(),
      environment: process.env.NODE_ENV
    });
  } catch (error) {
    console.error('Health check error:', error);
    return res.status(500).json({ status: 'error', error: 'Health check failed' });
  }
};

/**
 * Comprehensive health check with detailed component status
 * @public
 */
exports.getDetailedHealth = async (req, res) => {
  // Check if we have a valid cached response
  const now = Date.now();
  if (healthCache.data && now - healthCache.timestamp < healthCache.ttl) {
    return res.status(200).json(healthCache.data);
  }
  
  try {
    // Set a timeout for health check operations
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => resolve({ timedOut: true }), HEALTH_CHECK_TIMEOUT);
    });
    
    // Run all health checks in parallel with timeout
    const [dbHealth, redisHealth, externalHealth, systemHealth, applicationMetrics] = await Promise.all([
      Promise.race([exports.getDatabaseHealth(), timeoutPromise]),
      Promise.race([exports.getRedisHealth(), timeoutPromise]),
      Promise.race([exports.getExternalServicesHealth(), timeoutPromise]),
      Promise.race([exports.getSystemHealth(), timeoutPromise]),
      Promise.race([exports.getApplicationMetrics(), timeoutPromise])
    ]);
    
    // Aggregate status - only OK if all components are healthy
    const componentsOk = [
      dbHealth.status === 'ok',
      redisHealth.status === 'ok',
      externalHealth.status === 'ok',
      systemHealth.status === 'ok'
    ];
    
    const aggregatedStatus = componentsOk.every(status => status === true) ? 'ok' : 'degraded';
    
    const healthData = {
      status: aggregatedStatus,
      timestamp: new Date(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version,
      components: {
        database: dbHealth,
        redis: redisHealth,
        externalServices: externalHealth,
        system: systemHealth,
        metrics: applicationMetrics
      }
    };
    
    // Update cache
    healthCache.data = healthData;
    healthCache.timestamp = now;
    
    return res.status(200).json(healthData);
  } catch (error) {
    console.error('Detailed health check error:', error);
    return res.status(500).json({ 
      status: 'error', 
      error: 'Detailed health check failed',
      message: error.message
    });
  }
};

/**
 * Database health check
 * @private
 */
exports.getDatabaseHealth = async () => {
  try {
    // Check database connection
    await sequelize.authenticate();
    
    // Get database metrics
    const dbStats = {
      poolConnections: sequelize.connectionManager.pool.size,
      poolAvailable: sequelize.connectionManager.pool.available,
      poolIdle: sequelize.connectionManager.pool.idle,
      poolPending: sequelize.connectionManager.pool.pending
    };
    
    // Check query performance by running a simple query
    const startTime = Date.now();
    await User.count();
    const queryTime = Date.now() - startTime;
    
    return {
      status: 'ok',
      message: 'Database connection successful',
      latency: `${queryTime}ms`,
      poolStats: dbStats
    };
  } catch (error) {
    console.error('Database health check error:', error);
    return {
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    };
  }
};

/**
 * Redis health check
 * @private
 */
exports.getRedisHealth = async () => {
  if (!redisClient) {
    return {
      status: 'unknown',
      message: 'Redis client not configured'
    };
  }
  
  try {
    // Test Redis connection
    const startTime = Date.now();
    const pingResult = await redisClient.ping();
    const pingTime = Date.now() - startTime;
    
    // Get Redis info
    const info = await redisClient.info();
    
    // Parse useful Redis stats
    const memoryMatch = info.match(/used_memory_human:(.+)\r\n/);
    const connectedClients = info.match(/connected_clients:(.+)\r\n/);
    const uptimeInSeconds = info.match(/uptime_in_seconds:(.+)\r\n/);
    
    return {
      status: pingResult === 'PONG' ? 'ok' : 'error',
      message: 'Redis connection successful',
      latency: `${pingTime}ms`,
      stats: {
        memory: memoryMatch ? memoryMatch[1].trim() : 'unknown',
        clients: connectedClients ? parseInt(connectedClients[1].trim()) : 'unknown',
        uptime: uptimeInSeconds ? parseInt(uptimeInSeconds[1].trim()) : 'unknown'
      }
    };
  } catch (error) {
    console.error('Redis health check error:', error);
    return {
      status: 'error',
      message: 'Redis connection failed',
      error: error.message
    };
  }
};

/**
 * External services health check
 * @private
 */
exports.getExternalServicesHealth = async () => {
  // Initialize results object
  const results = {
    email: { status: 'unknown' },
    storage: { status: 'unknown' },
    thirdPartyApis: {}
  };
  
  // Check email service if configured
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        secure: process.env.SMTP_PORT === '465',
        auth: {
          user: process.env.SMTP_USER || '',
          pass: process.env.SMTP_PASS || ''
        },
        tls: {
          rejectUnauthorized: false
        }
      });
      
      // Verify connection configuration
      const startTime = Date.now();
      await transporter.verify();
      const verifyTime = Date.now() - startTime;
      
      results.email = {
        status: 'ok',
        message: 'SMTP connection successful',
        latency: `${verifyTime}ms`
      };
    } catch (error) {
      results.email = {
        status: 'error',
        message: 'SMTP connection failed',
        error: error.message
      };
    }
  }
  
  // Check file storage accessibility
  const storagePath = process.env.FILE_UPLOAD_PATH || './uploads';
  try {
    await fs.promises.access(storagePath, fs.constants.R_OK | fs.constants.W_OK);
    results.storage = {
      status: 'ok',
      message: 'File storage is accessible',
      path: storagePath
    };
  } catch (error) {
    results.storage = {
      status: 'error',
      message: 'File storage is not accessible',
      path: storagePath,
      error: error.message
    };
  }
  
  // Determine overall external services status
  const servicesStatus = Object.values(results)
    .filter(service => typeof service === 'object' && service.status)
    .every(service => service.status === 'ok');
  
  return {
    status: servicesStatus ? 'ok' : 'degraded',
    services: results
  };
};

/**
 * System health check
 * @private
 */
exports.getSystemHealth = async () => {
  try {
    // Get CPU load
    const cpuLoad = os.loadavg();
    const cpuCount = os.cpus().length;
    
    // Get memory usage
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;
    
    // Get system information
    const [diskInfo, processInfo] = await Promise.all([
      systeminformation.fsSize(),
      systeminformation.processes()
    ]);
    
    // Calculate disk usage for the main disk
    const mainDisk = diskInfo[0] || {};
    const diskUsagePercent = mainDisk.use || 0;
    
    // Node.js process memory
    const processMemory = process.memoryUsage();
    
    return {
      status: 'ok',
      cpu: {
        load: cpuLoad,
        count: cpuCount,
        loadPercent: (cpuLoad[0] / cpuCount) * 100
      },
      memory: {
        total: totalMemory,
        free: freeMemory,
        used: usedMemory,
        usagePercent: memoryUsagePercent.toFixed(2)
      },
      disk: {
        total: mainDisk.size,
        free: mainDisk.size - (mainDisk.used || 0),
        used: mainDisk.used,
        usagePercent: diskUsagePercent.toFixed(2)
      },
      process: {
        memory: {
          rss: processMemory.rss,
          heapTotal: processMemory.heapTotal,
          heapUsed: processMemory.heapUsed,
          external: processMemory.external
        },
        uptime: process.uptime()
      },
      system: {
        platform: process.platform,
        uptime: os.uptime(),
        hostname: os.hostname(),
        totalProcesses: processInfo.all
      }
    };
  } catch (error) {
    console.error('System health check error:', error);
    return {
      status: 'error',
      message: 'System health check failed',
      error: error.message
    };
  }
};

/**
 * Application metrics
 * @private
 */
exports.getApplicationMetrics = async () => {
  try {
    // Get application-specific metrics
    const [activeUsers, totalEvents, recentAttendance] = await Promise.all([
      User.count({
        where: {
          lastLoginAt: {
            [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      }),
      sequelize.models.Event ? sequelize.models.Event.count() : Promise.resolve(0),
      sequelize.models.AttendanceRecord ? 
        sequelize.models.AttendanceRecord.count({
          where: {
            createdAt: {
              [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
            }
          }
        }) : Promise.resolve(0)
    ]);
    
    return {
      activeUsers: activeUsers,
      totalEvents: totalEvents,
      recentAttendanceRecords: recentAttendance,
      timestamp: new Date()
    };
  } catch (error) {
    console.error('Application metrics error:', error);
    return {
      error: 'Failed to collect application metrics',
      message: error.message
    };
  }
};

/**
 * Kubernetes-style readiness probe
 * Checks if the application is ready to accept traffic
 * @public
 */
exports.getReadinessCheck = async (req, res) => {
  try {
    // Check database connection
    await sequelize.authenticate();
    
    // Check Redis connection if configured
    if (redisClient) {
      await redisClient.ping();
    }
    
    return res.status(200).json({
      status: 'ok',
      message: 'Application is ready'
    });
  } catch (error) {
    console.error('Readiness check failed:', error);
    return res.status(503).json({
      status: 'error',
      message: 'Application is not ready',
      error: error.message
    });
  }
};

/**
 * Kubernetes-style liveness probe
 * Checks if the application is running correctly
 * @public
 */
exports.getLivenessCheck = async (req, res) => {
  // Simple check to verify the application is running
  res.status(200).json({
    status: 'ok',
    message: 'Application is live',
    timestamp: new Date()
  });
};

/**
 * Kubernetes-style startup probe
 * Checks if the application has started up correctly
 * @public
 */
exports.getStartupCheck = async (req, res) => {
  try {
    // Check database connection
    await sequelize.authenticate();
    
    // Verify models are loaded
    const modelsLoaded = sequelize.models && 
                         Object.keys(sequelize.models).length > 0;
    
    if (!modelsLoaded) {
      throw new Error('Models not loaded');
    }
    
    return res.status(200).json({
      status: 'ok',
      message: 'Application has started successfully',
      modelsLoaded: Object.keys(sequelize.models).length
    });
  } catch (error) {
    console.error('Startup check failed:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Application startup failed',
      error: error.message
    });
  }
};