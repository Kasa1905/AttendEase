const express = require('express');
const router = express.Router();
const dutyController = require('../controllers/dutySessionController');
const { requireAuth } = require('../middleware/auth');
const { requireStudent, requireCoreTeamOrTeacher, requireOwnershipOrRole, requireDutySessionOwnershipOrRole } = require('../middleware/rbac');
const { validate, dutySessionStartSchema, dutySessionEndSchema, dutySessionUpdateSchema } = require('../middleware/validation');

router.use(requireAuth);

router.post('/start', requireStudent(), validate(dutySessionStartSchema), dutyController.startDutySession);
// defer ownership/role resolution to specialized middleware that loads the session
router.put('/:id/end', requireDutySessionOwnershipOrRole([ 'core_team', 'teacher' ]), validate(dutySessionEndSchema), dutyController.endDutySession);
router.get('/current', requireStudent(), dutyController.getCurrentSession);
router.get('/user/:userId', requireAuth, requireOwnershipOrRole([ 'core_team', 'teacher' ]), dutyController.getDutySessionHistory);
router.put('/:id', requireDutySessionOwnershipOrRole([ 'core_team', 'teacher' ]), validate(dutySessionUpdateSchema), dutyController.updateDutySession);
router.get('/stats', requireCoreTeamOrTeacher(), dutyController.getDutySessionStats);
router.get('/', requireCoreTeamOrTeacher(), dutyController.getDutySessionHistory);

module.exports = router;
