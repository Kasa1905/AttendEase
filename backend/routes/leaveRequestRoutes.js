const express = require('express');
const router = express.Router();
const controller = require('../controllers/leaveRequestController');
const { requireAuth, requireStudent, requireCoreTeam } = require('../middleware/auth');
const { validateBody, validateQuery, requestFilterSchema } = require('../middleware/validation');

router.post('/', requireAuth(), requireStudent(), validateBody('leaveRequestSubmitSchema'), controller.submitRequest);
router.get('/my', requireAuth(), requireStudent(), controller.getMyRequests);
router.get('/pending', requireAuth(), requireCoreTeam(), controller.getPendingRequests);
router.get('/', requireAuth(), requireCoreTeam(), validateQuery(requestFilterSchema), controller.getAllRequests);
router.put('/:id/approve', requireAuth(), requireCoreTeam(), validateBody('leaveRequestApprovalSchema'), controller.approveRequest);
router.put('/:id/reject', requireAuth(), requireCoreTeam(), validateBody('leaveRequestRejectionSchema'), controller.rejectRequest);
router.post('/bulk-approve', requireAuth(), requireCoreTeam(), validateBody('bulkApprovalSchema'), controller.bulkApproveRequests);
router.get('/stats', requireAuth(), requireCoreTeam(), controller.getRequestStats);
router.put('/:id', requireAuth(), requireStudent(), validateBody('leaveRequestUpdateSchema'), controller.updateRequest);
router.delete('/:id', requireAuth(), requireStudent(), controller.deleteRequest);

module.exports = router;
