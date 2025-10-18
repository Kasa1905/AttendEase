const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { requireAuth } = require('../middleware/auth');
const { requireCoreTeamOrTeacher, requireCoreTeam, requireTeacher } = require('../middleware/rbac');
const { validate, validateQuery, attendanceReportSchema, dutyLogReportSchema, penaltyReportSchema, dailySummaryReportSchema, memberActivityReportSchema, exportFormatSchema, reportPreviewSchema } = require('../middleware/validation');

// All report routes require authentication
router.use(requireAuth);

// Report generation endpoints
// Attendance reports - available to core team and teachers
router.get('/attendance', requireCoreTeamOrTeacher(), validateQuery('attendanceReportSchema'), reportController.generateAttendanceReport);

// Duty log reports - available to core team and teachers
router.get('/duty-logs', requireCoreTeamOrTeacher(), validateQuery('dutyLogReportSchema'), reportController.generateDutyLogReport);

// Penalty reports - available to core team and teachers
router.get('/penalties', requireCoreTeamOrTeacher(), validateQuery('penaltyReportSchema'), reportController.generatePenaltyReport);

// Daily summary reports - available to teachers
router.get('/daily-summary/:date', requireTeacher(), validateQuery('dailySummaryReportSchema'), reportController.generateDailySummaryReport);

// Member activity reports - available to core team only
router.get('/member-activity', requireCoreTeam(), validateQuery('memberActivityReportSchema'), reportController.generateMemberActivityReport);

// Export endpoints
// PDF export - available to core team and teachers
router.post('/export/pdf', requireCoreTeamOrTeacher(), validate('exportFormatSchema'), reportController.exportToPDF);

// Excel export - available to core team and teachers
router.post('/export/excel', requireCoreTeamOrTeacher(), validate('exportFormatSchema'), reportController.exportToExcel);

// CSV export - available to core team and teachers
router.post('/export/csv', requireCoreTeamOrTeacher(), validate('exportFormatSchema'), reportController.exportToCSV);

// Report preview - available to core team and teachers
router.post('/preview', requireCoreTeamOrTeacher(), validate('reportPreviewSchema'), reportController.getReportPreview);

module.exports = router;