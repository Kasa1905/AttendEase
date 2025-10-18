const Joi = require('joi');
const { ROLES } = require('../constants/roles');

const userCreateSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).requconst importHistorySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('processing', 'completed', 'failed', 'cancelled').optional(),
  sortBy: Joi.string().valid('startedAt', 'finishedAt', 'status', 'totalRows', 'successful', 'failed').default('startedAt'),
  sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC'),
  fromDate: Joi.date().optional(),
  toDate: Joi.date().optional()
});,
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  role: Joi.string().valid(ROLES.STUDENT, ROLES.CORE, ROLES.TEACHER)
});

const attendanceSchema = Joi.object({ userId: Joi.string().guid().required(), date: Joi.date().required(), status: Joi.string().valid('present_in_class', 'on_club_duty', 'absent').required() });

const attendanceWithDutySchema = attendanceSchema.keys({
  // when creating attendance with duty, optional notes and expected shift info
  notes: Joi.string().max(1000).optional(),
  expectedShift: Joi.object({ start: Joi.date().optional(), end: Joi.date().optional() }).optional()
});

const loginSchema = Joi.object({ email: Joi.string().email().required(), password: Joi.string().required() });

const registerSchema = Joi.object({ email: Joi.string().email().required(), password: Joi.string().min(6).required(), firstName: Joi.string().required(), lastName: Joi.string().required(), role: Joi.string().valid(ROLES.STUDENT).default(ROLES.STUDENT) });

const changePasswordSchema = Joi.object({ currentPassword: Joi.string().required(), newPassword: Joi.string().min(6).required() });

const profileUpdateSchema = Joi.object({ firstName: Joi.string().optional(), lastName: Joi.string().optional(), department: Joi.string().optional(), year: Joi.number().optional(), section: Joi.string().optional() });

const refreshTokenSchema = Joi.object({ refreshToken: Joi.string().required() });

const dutySessionStartSchema = Joi.object({ eventId: Joi.number().optional(), notes: Joi.string().max(1000).optional() });
const dutySessionEndSchema = Joi.object({ notes: Joi.string().max(1000).optional() });
const dutySessionUpdateSchema = Joi.object({ eventId: Joi.number().optional(), notes: Joi.string().max(1000).optional() });

const hourlyLogSchema = Joi.object({ sessionId: Joi.number().required(), previousHourWork: Joi.string().min(5).required(), nextHourPlan: Joi.string().min(5).required() });
const hourlyLogUpdateSchema = Joi.object({ previousHourWork: Joi.string().min(5).optional(), nextHourPlan: Joi.string().min(5).optional() });
// break start/end carry no body, enforce empty object to avoid accidental writes
const breakStartSchema = Joi.object().max(0);
const breakEndSchema = Joi.object().max(0);

const leaveRequestSubmitSchema = Joi.object({ requestType: Joi.string().valid('leave', 'club_duty').required(), requestDate: Joi.date().required(), reason: Joi.string().min(10).required() });
const leaveRequestUpdateSchema = Joi.object({ requestDate: Joi.date().optional(), reason: Joi.string().min(10).optional() });
const leaveRequestApprovalSchema = Joi.object({ notes: Joi.string().max(1000).optional() }).unknown(true);
const leaveRequestRejectionSchema = Joi.object({ rejectionReason: Joi.string().min(5).required() });
const bulkApprovalSchema = Joi.object({ ids: Joi.array().items(Joi.number().required()).min(1).required() });
const requestFilterSchema = Joi.object({ status: Joi.string().valid('pending','approved','rejected').optional(), fromDate: Joi.date().optional(), toDate: Joi.date().optional(), userId: Joi.number().optional() });

const notificationCreateSchema = Joi.object({ userId: Joi.string().guid().required(), type: Joi.string().valid('hourly_reminder','request_approved','request_rejected','duty_session_reminder','strike_warning','generic').required(), title: Joi.string().required(), message: Joi.string().required(), data: Joi.object().optional() });
const notificationUpdateSchema = Joi.object({ isRead: Joi.boolean().optional(), readAt: Joi.date().optional() });
const notificationFilterSchema = Joi.object({ type: Joi.string().optional(), isRead: Joi.boolean().optional(), fromDate: Joi.date().optional(), toDate: Joi.date().optional() });
const bulkNotificationSchema = Joi.object({ ids: Joi.array().items(Joi.string().guid()).min(1).required() });

const strikeResolveSchema = Joi.object({ resolutionNotes: Joi.string().max(500).optional() });
const strikeFilterSchema = Joi.object({ status: Joi.string().valid('active', 'resolved').optional(), reason: Joi.string().valid('missed_hourly_log', 'insufficient_duty_hours', 'excessive_break').optional(), fromDate: Joi.date().optional(), toDate: Joi.date().optional(), page: Joi.number().integer().min(1).optional(), pageSize: Joi.number().integer().min(1).max(100).optional() });
const bulkStrikeResolveSchema = Joi.object({ strikeIds: Joi.array().items(Joi.string().guid()).min(1).required(), resolutionNotes: Joi.string().max(500).optional() });
const strikeStatisticsSchema = Joi.object({ userId: Joi.string().guid().optional(), fromDate: Joi.date().optional(), toDate: Joi.date().optional() });
const userSuspensionSchema = Joi.object({ days: Joi.number().integer().min(1).max(30).required() });

// Teacher dashboard validation schemas
const bulkAttendanceApprovalSchema = Joi.object({
  ids: Joi.array().items(Joi.number().integer()).min(1).required()
});

const bulkAttendanceRejectionSchema = Joi.object({
  ids: Joi.array().items(Joi.number().integer()).min(1).required(),
  reason: Joi.string().min(5).max(500).required()
});

const dailySummaryFilterSchema = Joi.object({
  date: Joi.date().required()
});

const attendanceFilterSchema = Joi.object({
  status: Joi.string().valid('present_in_class', 'on_club_duty', 'absent').optional(),
  isApproved: Joi.boolean().optional(),
  fromDate: Joi.date().optional(),
  toDate: Joi.date().optional(),
  studentId: Joi.string().guid().optional(),
  page: Joi.number().integer().min(1).optional(),
  pageSize: Joi.number().integer().min(1).max(100).optional()
});

const pendingApprovalFilterSchema = Joi.object({
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional(),
  studentId: Joi.number().integer().optional(),
  page: Joi.number().integer().min(1).optional(),
  pageSize: Joi.number().integer().min(1).max(100).optional()
});

// Report validation schemas
const reportFiltersSchema = Joi.object({
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional(),
  userId: Joi.string().guid().optional(),
  status: Joi.alternatives().try(
    Joi.string().valid('present_in_class', 'on_club_duty', 'absent'),
    Joi.array().items(Joi.string().valid('present_in_class', 'on_club_duty', 'absent'))
  ).optional(),
  approvalStatus: Joi.string().valid('approved', 'rejected', 'pending').optional(),
  eventId: Joi.string().guid().optional(),
  isActive: Joi.boolean().optional(),
  reason: Joi.alternatives().try(
    Joi.string().valid('missed_hourly_log', 'insufficient_duty_hours', 'excessive_break', 'other'),
    Joi.array().items(Joi.string().valid('missed_hourly_log', 'insufficient_duty_hours', 'excessive_break', 'other'))
  ).optional(),
  severity: Joi.alternatives().try(
    Joi.string().valid('warning', 'minor', 'major'),
    Joi.array().items(Joi.string().valid('warning', 'minor', 'major'))
  ).optional(),
  role: Joi.string().valid('student', 'teacher', 'core_team').optional()
});

const attendanceReportSchema = Joi.object({
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional(),
  userId: Joi.string().guid().optional(),
  status: Joi.alternatives().try(
    Joi.string().valid('present_in_class', 'on_club_duty', 'absent'),
    Joi.array().items(Joi.string().valid('present_in_class', 'on_club_duty', 'absent'))
  ).optional(),
  approvalStatus: Joi.string().valid('approved', 'rejected', 'pending').optional()
});

const dutyLogReportSchema = Joi.object({
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional(),
  userId: Joi.string().guid().optional(),
  eventId: Joi.string().guid().optional(),
  isActive: Joi.boolean().optional()
});

const penaltyReportSchema = Joi.object({
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional(),
  userId: Joi.string().guid().optional(),
  reason: Joi.alternatives().try(
    Joi.string().valid('missed_hourly_log', 'insufficient_duty_hours', 'excessive_break', 'other'),
    Joi.array().items(Joi.string().valid('missed_hourly_log', 'insufficient_duty_hours', 'excessive_break', 'other'))
  ).optional(),
  severity: Joi.alternatives().try(
    Joi.string().valid('warning', 'minor', 'major'),
    Joi.array().items(Joi.string().valid('warning', 'minor', 'major'))
  ).optional(),
  isActive: Joi.boolean().optional()
});

const dailySummaryReportSchema = Joi.object({
  date: Joi.date().required(),
  userId: Joi.string().guid().optional()
});

const memberActivityReportSchema = Joi.object({
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional(),
  role: Joi.string().valid('student', 'teacher', 'core_team').optional()
});

const exportFormatSchema = Joi.object({
  format: Joi.string().valid('pdf', 'excel', 'csv').required(),
  reportType: Joi.string().valid('attendance', 'duty', 'penalty', 'daily').required()
});

const reportPreviewSchema = Joi.object({
  reportType: Joi.string().valid('attendance', 'duty', 'penalty', 'daily').required(),
  filters: reportFiltersSchema.optional(),
  limit: Joi.number().integer().min(1).max(100).default(50)
});

// Import validation schemas
const userImportPreviewSchema = Joi.object({
  // File validation is handled by multer middleware
});

const userImportConfirmSchema = Joi.object({
  batchId: Joi.string().guid().required(),
  validRows: Joi.array().items(
    Joi.object({
      rowNumber: Joi.number().integer().min(1).required(),
      data: Joi.object({
        email: Joi.string().email().required(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        role: Joi.string().valid('student', 'core_team').required(),
        studentId: Joi.string().optional(),
        department: Joi.string().optional(),
        year: Joi.alternatives(Joi.string(), Joi.number()).optional(),
        section: Joi.string().optional()
      }).required()
    })
  ).min(1).required(),
  fileName: Joi.string().optional(),
  format: Joi.string().valid('csv', 'xlsx').optional()
});

const importHistorySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  status: Joi.string().valid('processing', 'completed', 'failed', 'cancelled').optional(),
  sortBy: Joi.string().valid('startedAt', 'finishedAt', 'status', 'totalRows', 'successful', 'failed').default('startedAt'),
  sortOrder: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC'),
  fromDate: Joi.date().optional(),
  toDate: Joi.date().optional()
});

const userBulkCreateSchema = Joi.object({
  users: Joi.array().items(
    Joi.object({
      email: Joi.string().email().required(),
      firstName: Joi.string().required(),
      lastName: Joi.string().required(),
      role: Joi.string().valid('student', 'core_team').required(),
      studentId: Joi.string().optional(),
      department: Joi.string().optional(),
      year: Joi.alternatives(Joi.string(), Joi.number()).optional(),
      section: Joi.string().optional()
    })
  ).min(1).max(1000).required()
});

function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });
    next();
  };
}

function validateBody(name) {
  const map = {
    leaveRequestSubmitSchema,
    leaveRequestUpdateSchema,
    leaveRequestApprovalSchema,
    leaveRequestRejectionSchema,
    bulkApprovalSchema,
    requestFilterSchema,
    strikeResolveSchema,
    strikeFilterSchema,
    bulkStrikeResolveSchema,
    strikeStatisticsSchema,
    userSuspensionSchema,
  };
  const schema = map[name];
  if (!schema) throw new Error('Unknown schema: ' + name);
  return validate(schema);
}

function validateQuery(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.query);
    if (error) return res.status(400).json({ error: error.details[0].message });
    next();
  };
}

module.exports = {
  validate,
  validateBody,
  validateQuery,
  userCreateSchema,
  attendanceSchema,
  attendanceWithDutySchema,
  loginSchema,
  registerSchema,
  changePasswordSchema,
  profileUpdateSchema,
  refreshTokenSchema,
  dutySessionStartSchema,
  dutySessionEndSchema,
  dutySessionUpdateSchema,
  hourlyLogSchema,
  hourlyLogUpdateSchema,
  breakStartSchema,
  breakEndSchema,
  // leave request schemas
  leaveRequestSubmitSchema,
  leaveRequestUpdateSchema,
  leaveRequestApprovalSchema,
  leaveRequestRejectionSchema,
  bulkApprovalSchema,
  requestFilterSchema,
  // notification schemas
  notificationCreateSchema,
  notificationUpdateSchema,
  notificationFilterSchema,
  bulkNotificationSchema,
  // strike schemas
  strikeResolveSchema,
  strikeFilterSchema,
  bulkStrikeResolveSchema,
  strikeStatisticsSchema,
  userSuspensionSchema,
  // teacher dashboard schemas
  bulkAttendanceApprovalSchema,
  bulkAttendanceRejectionSchema,
  dailySummaryFilterSchema,
  attendanceFilterSchema,
  pendingApprovalFilterSchema,
  // report schemas
  reportFiltersSchema,
  attendanceReportSchema,
  dutyLogReportSchema,
  penaltyReportSchema,
  dailySummaryReportSchema,
  memberActivityReportSchema,
  exportFormatSchema,
  reportPreviewSchema,
  // import schemas
  userImportPreviewSchema,
  userImportConfirmSchema,
  importHistorySchema,
  userBulkCreateSchema,
};

