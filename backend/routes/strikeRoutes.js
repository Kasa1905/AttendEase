const express = require('express');
const router = express.Router();
const strikeController = require('../controllers/strikeController');
const { requireAuth } = require('../middleware/auth');
const { requireStudent, requireCoreTeam, requireCoreTeamOrTeacher } = require('../middleware/rbac');
const { validateQuery, validateBody, strikeFilterSchema, strikeStatisticsSchema } = require('../middleware/validation');

// GET /strikes/me - Get own strikes (students only)
router.get('/me',
  requireAuth,
  requireStudent,
  validateQuery(strikeFilterSchema),
  strikeController.getMyStrikes
);

// GET /strikes/user/:userId - Get strikes for specific user (core team and teachers)
router.get('/user/:userId',
  requireAuth,
  requireCoreTeamOrTeacher,
  validateQuery(strikeFilterSchema),
  strikeController.getUserStrikes
);

// GET /strikes/user/:userId/active-count - Get active strike count (all authenticated users)
router.get('/user/:userId/active-count',
  requireAuth,
  strikeController.getActiveStrikeCount
);

// GET /strikes/me/active-count - Get own active strike count (all authenticated users)
router.get('/me/active-count',
  requireAuth,
  strikeController.getMyActiveStrikeCount
);

// GET /strikes - Get all strikes with filtering (core team and teachers)
router.get('/',
  requireAuth,
  requireCoreTeamOrTeacher,
  validateQuery(strikeFilterSchema),
  strikeController.getAllStrikes
);

// PUT /strikes/:id/resolve - Resolve specific strike (core team only)
router.put('/:id/resolve',
  requireAuth,
  requireCoreTeam,
  validateBody('strikeResolveSchema'),
  strikeController.resolveStrike
);

// POST /strikes/bulk-resolve - Resolve multiple strikes (core team only)
router.post('/bulk-resolve',
  requireAuth,
  requireCoreTeam,
  validateBody('bulkStrikeResolveSchema'),
  strikeController.bulkResolveStrikes
);

// GET /strikes/statistics - Get strike statistics (core team and teachers)
router.get('/statistics',
  requireAuth,
  requireCoreTeamOrTeacher,
  validateQuery(strikeStatisticsSchema),
  strikeController.getStrikeStatistics
);

// GET /strikes/history - Get comprehensive strike history (core team and teachers)
router.get('/history',
  requireAuth,
  requireCoreTeamOrTeacher,
  validateQuery(strikeFilterSchema),
  strikeController.getStrikeHistory
);

module.exports = router;