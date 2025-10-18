const express = require('express');
const router = express.Router();
const hourlyController = require('../controllers/hourlyLogController');
const { requireAuth } = require('../middleware/auth');
const { requireStudent, requireCoreTeamOrTeacher, requireOwnershipOrRole, requireDutySessionOwnershipOrRole } = require('../middleware/rbac');
const { validate, hourlyLogSchema, hourlyLogUpdateSchema, breakStartSchema, breakEndSchema } = require('../middleware/validation');

router.use(requireAuth);

router.post('/', requireStudent(), validate(hourlyLogSchema), hourlyController.createHourlyLog);
router.get('/session/:sessionId', requireDutySessionOwnershipOrRole([ 'core_team', 'teacher' ]), hourlyController.getHourlyLogs);
router.put('/:id', requireStudent(), validate(hourlyLogUpdateSchema), hourlyController.updateHourlyLog);
router.post('/:id/break/start', requireStudent(), validate(breakStartSchema), hourlyController.startBreak);
router.put('/:id/break/end', requireStudent(), validate(breakEndSchema), hourlyController.endBreak);
router.get('/missed/:userId', requireCoreTeamOrTeacher(), hourlyController.getMissedLogs);
router.post('/missed/:userId', requireCoreTeamOrTeacher(), hourlyController.createMissedLogStrikes);
router.get('/user/:userId', requireOwnershipOrRole([ 'core_team', 'teacher' ]), hourlyController.getHourlyLogs);

module.exports = router;
