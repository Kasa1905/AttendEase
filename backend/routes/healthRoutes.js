/**
 * Health Routes
 * Provides comprehensive health check endpoints for monitoring
 */
const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');
const { requireAuth, optionalAuth } = require('../middleware/auth');

// Rate limiting middleware for health endpoints
const rateLimit = require('express-rate-limit');
const healthRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per minute
  message: { status: 'error', message: 'Too many health check requests' },
  standardHeaders: true,
  legacyHeaders: false
});

// Basic health check for load balancers and simple monitoring
router.get('/', optionalAuth, healthController.getHealthStatus);

// Comprehensive health status with all component details
// Detailed health check endpoint - requires authentication
router.get('/detailed', requireAuth, healthController.getDetailedHealth);

// Kubernetes-style probes
router.get('/ready', healthController.getReadinessCheck);
router.get('/live', healthController.getLivenessCheck);
router.get('/startup', healthController.getStartupCheck);

// Component-specific health endpoints - all require authentication
router.get('/database', requireAuth, healthRateLimit, async (req, res) => res.json(await healthController.getDatabaseHealth()));
router.get('/redis', requireAuth, healthRateLimit, async (req, res) => res.json(await healthController.getRedisHealth()));
router.get('/external', requireAuth, healthRateLimit, async (req, res) => res.json(await healthController.getExternalServicesHealth()));
router.get('/system', requireAuth, healthRateLimit, async (req, res) => res.json(await healthController.getSystemHealth()));

module.exports = router;