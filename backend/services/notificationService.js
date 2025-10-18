const { Notification, User } = require('../models');
const socketServer = require('../socket/socketServer');
const cron = require('node-cron');

async function sendNotification(userId, type, title, message, data = {}) {
  try {
    const n = await Notification.create({ userId, type, title, message, data });
    // emit real-time
    socketServer.emitToUser(userId, 'notification', { id: n.id, type, title, message, data, createdAt: n.createdAt });
    return n;
  } catch (e) { console.error('sendNotification', e); throw e; }
}

async function sendRoleNotification(role, type, title, message, data = {}) {
  try {
    // persist individual notifications for role members (simplified: lookup users)
    const users = await User.findAll({ where: { role } });
    const created = [];
    for (const u of users) {
      const n = await Notification.create({ userId: u.id, type, title, message, data });
      created.push(n);
      socketServer.emitToUser(u.id, 'notification', { id: n.id, type, title, message, data, createdAt: n.createdAt });
    }
    // also emit to role room
    socketServer.emitToRole(role, 'notification:role', { type, title, message, data });
    return created;
  } catch (e) { console.error('sendRoleNotification', e); throw e; }
}

const scheduledJobs = new Map();

function scheduleHourlyReminders(userId, sessionId, intervalMinutes = 60) {
  // create a cron job running every intervalMinutes (approximation)
  const cronExpr = `*/${Math.max(1, Math.floor(intervalMinutes))} * * * *`;
  const job = cron.schedule(cronExpr, async () => {
    try {
      await sendNotification(userId, 'hourly_reminder', 'Hourly Reminder', 'Time to log your hourly work', { sessionId });
    } catch (e) { console.error('hourly reminder failed', e); }
  });
  scheduledJobs.set(sessionId, job);
  return job;
}

function cancelScheduledReminders(sessionId) {
  const job = scheduledJobs.get(sessionId);
  if (job) { job.stop(); scheduledJobs.delete(sessionId); }
}

module.exports = { sendNotification, sendRoleNotification, scheduleHourlyReminders, cancelScheduledReminders };

// Typed helpers
async function sendRequestApprovalNotification(userId, request) {
  return sendNotification(userId, 'request_approved', 'Request Approved', `Your request for ${request.requestDate} was approved.`, { requestId: request.id });
}

async function sendRequestRejectionNotification(userId, request) {
  return sendNotification(userId, 'request_rejected', 'Request Rejected', `Your request for ${request.requestDate} was rejected.`, { requestId: request.id });
}

async function sendAttendanceUpdateNotification(userId, attendance) {
  return sendNotification(userId, 'attendance_update', 'Attendance Updated', `Status: ${attendance.status}`, { date: attendance.date });
}

async function sendHourlyReminder(userId, sessionId) {
  return sendNotification(userId, 'hourly_reminder', 'Hourly Reminder', 'Time to log your hourly work', { sessionId });
}

module.exports = Object.assign(module.exports, { sendRequestApprovalNotification, sendRequestRejectionNotification, sendAttendanceUpdateNotification, sendHourlyReminder });
