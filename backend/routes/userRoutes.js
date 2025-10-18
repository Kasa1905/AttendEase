const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const userImportController = require('../controllers/userImportController');
const { requireAuth } = require('../middleware/auth');
const { requireCoreTeamOrTeacher, requireOwnershipOrRole, requireCoreTeam } = require('../middleware/rbac');
const { ROLES } = require('../constants/roles');
const { upload } = require('../config/multer');
const { validate, validateQuery } = require('../middleware/validation');
const { userImportPreviewSchema, userImportConfirmSchema, importHistorySchema } = require('../middleware/validation');

// All user routes require auth
router.use(requireAuth);

// Administrative routes (core team or teacher)
router.get('/', requireCoreTeamOrTeacher(), userController.getAllUsers);
router.get('/role/:role', requireCoreTeamOrTeacher(), userController.getUsersByRole);

// Get own profile or admins
router.get('/:id', requireOwnershipOrRole([ROLES.CORE, ROLES.TEACHER]), userController.getUserById);

// Creation/updation/deletion limited to admins
// Admin creation of users via this endpoint has been removed to enforce self-registration.
// If administrative creation is required, use a dedicated admin tool with auditing.
router.put('/:id', requireOwnershipOrRole([ROLES.CORE, ROLES.TEACHER]), userController.updateUser);
router.delete('/:id', requireCoreTeamOrTeacher(), userController.deleteUser);

// Import routes (core team only)
router.post('/import/preview', requireCoreTeam(), upload.single('file'), validate(userImportPreviewSchema), userImportController.uploadAndPreview);
router.post('/import/confirm', requireCoreTeam(), validate(userImportConfirmSchema), userImportController.confirmImport);
router.get('/import/template', requireCoreTeam(), userImportController.downloadTemplate);
router.get('/import/history', requireCoreTeam(), validateQuery(importHistorySchema), userImportController.getImportHistory);

module.exports = router;
