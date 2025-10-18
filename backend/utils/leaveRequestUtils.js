function toLocalDateParts(dateLike) {
  if (typeof dateLike === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) {
    const [y, m, d] = dateLike.split('-').map(Number);
    return { y, m: m - 1, d };
  }
  const dt = new Date(dateLike);
  return { y: dt.getFullYear(), m: dt.getMonth(), d: dt.getDate() };
}

function validateSubmissionTime(submittedAt, requestDate) {
  // submittedAt must be before or equal to 9:00 AM on requestDate (local time)
  const { y, m, d } = toLocalDateParts(requestDate);
  const nineAmLocal = new Date(y, m, d, 9, 0, 0, 0);
  const submitted = (submittedAt instanceof Date) ? submittedAt : new Date(submittedAt);
  return submitted.getTime() <= nineAmLocal.getTime();
}

function calculateDeadlineWarning(requestDate) {
  const { y, m, d } = toLocalDateParts(requestDate);
  const nineAmLocal = new Date(y, m, d, 9, 0, 0, 0);
  const ms = nineAmLocal.getTime() - Date.now();
  if (ms <= 0) return 'Deadline passed';
  const minutes = Math.ceil(ms / 60000);
  return `${minutes} minutes until 9:00 AM deadline`;
}

function validateRequestDate(requestDate) {
  const now = new Date();
  const { y, m, d } = toLocalDateParts(requestDate);
  const provided = new Date(y, m, d, 0, 0, 0, 0).getTime();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
  return provided >= todayStart; // allow today and future
}

// Stub: check conflicts for a user given a Sequelize model (resolve in controller)
async function checkRequestConflicts(LeaveRequestModel, userId, requestDate, excludeId = null) {
  const { y, m, d } = toLocalDateParts(requestDate);
  const start = new Date(y, m, d, 0, 0, 0, 0);
  const end = new Date(y, m, d, 23, 59, 59, 999);
  const { Op } = require('sequelize');
  const where = { userId, requestDate: { [Op.between]: [start, end] } };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const existing = await LeaveRequestModel.findOne({ where });
  return !!existing;
}

function validateBulkApproval(requests) {
  // basic stub: ensure array and ids present
  if (!Array.isArray(requests)) return false;
  return requests.every(r => r && (typeof r === 'number' || (r.id && typeof r.id === 'number')));
}

function formatRequestStatus(status) { return status; }

module.exports = {
  toLocalDateParts,
  validateSubmissionTime,
  calculateDeadlineWarning,
  validateRequestDate,
  checkRequestConflicts,
  validateBulkApproval,
  formatRequestStatus,
};
