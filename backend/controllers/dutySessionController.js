const { DutySession, AttendanceRecord, HourlyLog, User } = require('../models');
const { calculateDutyDuration, validateMinimumDutyHours, calculateBreakTime, formatDutySessionSummary } = require('../utils/attendanceUtils');
const { scheduleHourlyReminders, cancelScheduledReminders, sendNotification } = require('../services/notificationService');
const strikeService = require('../services/strikeService');

module.exports = {
  async startDutySession(req, res, next) {
    try {
      const userId = req.user.id;
      // ensure no active session for this user
      const active = await DutySession.findOne({ where: { userId, endedAt: null } });
      if (active) return res.status(400).json({ error: 'Active duty session already exists' });

      const { eventId = null, notes = null } = req.body;
      const session = await DutySession.create({ userId, eventId, notes, startedAt: new Date(), endedAt: null });

      // schedule hourly reminders for this session
      try {
        scheduleHourlyReminders(userId, session.id, parseInt(process.env.NOTIFICATION_REMINDER_INTERVAL || '60', 10));
        // notify user that session started
        await sendNotification(userId, 'duty_session_reminder', 'Duty session started', "We’ll remind you hourly to log work.", { sessionId: session.id });
      } catch (e) { console.error('scheduling reminders failed', e); }

      // create or update attendance record for today as on_club_duty
      const today = new Date();
      const [attendance] = await AttendanceRecord.findOrCreate({ where: { userId, date: today.toISOString().slice(0,10) }, defaults: { status: 'on_club_duty', userId, date: today.toISOString().slice(0,10) } });
      if (!attendance.status || attendance.status !== 'on_club_duty') await attendance.update({ status: 'on_club_duty' });

      res.json({ data: session });
    } catch (err) { next(err); }
  },

  async endDutySession(req, res, next) {
    try {
      const session = await DutySession.findByPk(req.params.id, { include: [{ model: HourlyLog, as: 'HourlyLogs' }] });
  if (!session) return res.status(404).json({ error: 'Duty session not found' });
  if (session.endedAt) return res.status(400).json({ error: 'Session already ended' });

  session.endedAt = new Date();
      // compute duration excluding breaks
      const total = calculateDutyDuration(session);
      session.totalDurationMinutes = total;
  await session.save();

  // cancel any scheduled reminders
  try { cancelScheduledReminders(session.id); } catch (e) { console.error('cancel reminders failed', e); }

      // validate minimum duty hours (2 hours -> 120 minutes)
      const eligible = validateMinimumDutyHours(total, 120);

      // Create strike for insufficient duty hours if not eligible
      if (!eligible) {
        try {
          await strikeService.createInsufficientDutyStrike(session.userId, session.id, total);
        } catch (strikeError) {
          console.error('Failed to create insufficient duty strike:', strikeError);
        }
      }

      // Check and create strikes for missed hourly logs
      try {
        await strikeService.checkAndCreateMissedLogStrikes(session.userId, session.id);
      } catch (strikeError) {
        console.error('Failed to check and create missed log strikes:', strikeError);
      }

      // update attendance record for the date
      const dateKey = (session.startedAt || session.startTime).toISOString().slice(0,10);
      const attendance = await AttendanceRecord.findOne({ where: { userId: session.userId, date: dateKey } });
      if (attendance) {
        await attendance.update({ dutyEligible: eligible });
      }

      // send end summary notification
      try {
        await sendNotification(session.userId, 'duty_session_reminder', 'Duty session ended', `Total: ${total} mins`, { sessionId: session.id, eligible });
      } catch (e) { console.error('send end notification failed', e); }

      res.json({ data: { session: formatDutySessionSummary(session), eligible } });
    } catch (err) { next(err); }
  },

  async getCurrentSession(req, res, next) {
    try {
      const userId = req.user.id;
      const session = await DutySession.findOne({ where: { userId, endedAt: null }, include: [{ model: HourlyLog, as: 'HourlyLogs' }] });
      res.json({ data: session });
    } catch (err) { next(err); }
  },

  async getDutySessionHistory(req, res, next) {
    try {
      const Sequelize = require('sequelize');
      const { Op } = Sequelize;
      const { userId: paramUserId } = req.params;
      const { userId: qUserId, from, to, eventId } = req.query;
      const where = {};
      // decide effective userId: route param takes precedence then query param
      const effectiveUserId = paramUserId || qUserId;
      if (effectiveUserId) where.userId = effectiveUserId;
      if (from || to) {
        where.startTime = {
          ...(from ? { [Op.gte]: new Date(from) } : {}),
          ...(to ? { [Op.lte]: new Date(to) } : {})
        };
      }
      if (eventId) where.eventId = eventId;
      // RBAC: if student, restrict to their own sessions
      if (req.user.role === 'student') {
        where.userId = req.user.id;
      }
      const sessions = await DutySession.findAll({ where, include: [{ model: HourlyLog, as: 'HourlyLogs' }], order: [['startTime','DESC']] });
      res.json({ data: sessions.map(formatDutySessionSummary) });
    } catch (err) { next(err); }
  },

  async updateDutySession(req, res, next) {
    try {
      const session = await DutySession.findByPk(req.params.id);
  if (!session) return res.status(404).json({ error: 'Duty session not found' });
  const updatable = ['notes','eventId'];
      for (const k of updatable) if (k in req.body) session[k] = req.body[k];
      await session.save();
      res.json({ data: formatDutySessionSummary(session) });
    } catch (err) { next(err); }
  },

  async getDutySessionStats(req, res, next) {
    try {
      // simple stats example
      const { userId } = req.query;
      const where = userId ? { userId } : {};
      const sessions = await DutySession.findAll({ where });
      const totalMinutes = sessions.reduce((s, sess) => s + (sess.totalDurationMinutes || 0), 0);
      const avg = sessions.length ? Math.round(totalMinutes / sessions.length) : 0;
      res.json({ data: { totalMinutes, sessionCount: sessions.length, averageMinutes: avg } });
    } catch (err) { next(err); }
  }
};
