const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const { requireAuth } = require('../middleware/auth');
const { requireStudent, requireCoreTeamOrTeacher, requireTeacher, requireOwnershipOrRole } = require('../middleware/rbac');
const { validate, validateQuery, bulkAttendanceApprovalSchema, bulkAttendanceRejectionSchema, pendingApprovalFilterSchema } = require('../middleware/validation');

// All attendance routes require auth
router.use(requireAuth);

// Students can create attendance for themselves
router.post('/', requireStudent(), attendanceController.markAttendance);

// Student can view their own records; admins can view any
router.get('/user/:userId', requireOwnershipOrRole(['core_team', 'teacher']), attendanceController.getAttendanceByUser);

// Admins and teachers can get attendance by date
router.get('/date/:date', requireCoreTeamOrTeacher(), attendanceController.getAttendanceByDate);

// Approval endpoint restricted to teachers
router.put('/:id/approve', requireTeacher(), attendanceController.updateAttendanceStatus);

// Bulk operations for teachers
router.post('/bulk-approve', requireTeacher(), validate(bulkAttendanceApprovalSchema), attendanceController.bulkApproveAttendance);
router.post('/bulk-reject', requireTeacher(), validate(bulkAttendanceRejectionSchema), attendanceController.bulkRejectAttendance);

// Daily summary for teachers and core team
router.get('/daily-summary/:date', requireCoreTeamOrTeacher(), attendanceController.getDailySummary);

// Pending approval for teachers
router.get('/pending-approval', requireTeacher(), validateQuery(pendingApprovalFilterSchema), attendanceController.getPendingApproval);

// Attendance with details for validation
router.get('/:id/details', requireCoreTeamOrTeacher(), attendanceController.getAttendanceWithDetails);

// Stats for admins
router.get('/stats', requireCoreTeamOrTeacher(), attendanceController.getAttendanceStats);

module.exports = router;
