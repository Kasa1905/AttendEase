const { HourlyLog, DutySession, Strike, User } = require('../models');
const { validateBreakDuration, isWithinLogWindow, generateMissedLogStrikes, validateLogTiming } = require('../utils/attendanceUtils');
const strikeService = require('../services/strikeService');

module.exports = {
  async createHourlyLog(req, res, next) {
    try {
      const userId = req.user.id;
      const { sessionId, previousHourWork, nextHourPlan } = req.body;
      if (!sessionId || !previousHourWork || !nextHourPlan) return res.status(400).json({ error: 'Missing required fields' });
      const session = await DutySession.findByPk(sessionId);
      if (!session) return res.status(404).json({ error: 'Session not found' });
      if (String(session.userId) !== String(userId)) return res.status(403).json({ error: 'Forbidden' });

  // validate timing window
  const proposedTime = new Date();
  if (!await validateLogTiming(session, proposedTime)) return res.status(400).json({ error: 'Log not within allowed hourly cadence window' });

      const log = await HourlyLog.create({ dutySessionId: sessionId, userId, previousHourWork, nextHourPlan, createdAt: new Date() });
      res.json({ data: log });
    } catch (err) { next(err); }
  },

  async getHourlyLogs(req, res, next) {
    try {
      const { sessionId, userId } = req.params;
      const where = {};
      if (sessionId) where.dutySessionId = sessionId;
      if (userId) where.userId = userId;
      // ownership: if requesting by sessionId, ensure caller owns session unless core/teacher
      if (sessionId) {
        const session = await DutySession.findByPk(sessionId);
        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (String(session.userId) !== String(req.user.id) && !(req.user.role === 'core_team' || req.user.role === 'teacher')) return res.status(403).json({ error: 'Forbidden' });
      }
      if (userId && String(userId) !== String(req.user.id) && !(req.user.role === 'core_team' || req.user.role === 'teacher')) return res.status(403).json({ error: 'Forbidden' });
      const logs = await HourlyLog.findAll({ where, order: [['createdAt','ASC']] });
      res.json({ data: logs });
    } catch (err) { next(err); }
  },

  async updateHourlyLog(req, res, next) {
    try {
      const log = await HourlyLog.findByPk(req.params.id);
      if (!log) return res.status(404).json({ error: 'Log not found' });
      if (String(log.userId) !== String(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
      // allow update within short window (15 minutes)
      const age = (Date.now() - new Date(log.createdAt).getTime())/60000;
      if (age > 15) return res.status(400).json({ error: 'Update window elapsed' });
      const updatable = ['previousHourWork','nextHourPlan'];
      for (const k of updatable) if (k in req.body) log[k] = req.body[k];
      await log.save();
      res.json({ data: log });
    } catch (err) { next(err); }
  },

  async startBreak(req, res, next) {
    try {
      const log = await HourlyLog.findByPk(req.params.id);
      if (!log) return res.status(404).json({ error: 'Log not found' });
      if (String(log.userId) !== String(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
      if (log.breakStartedAt) return res.status(400).json({ error: 'Break already started' });
      log.breakStartedAt = new Date();
      await log.save();
      res.json({ data: log });
    } catch (err) { next(err); }
  },

  async endBreak(req, res, next) {
    try {
      const log = await HourlyLog.findByPk(req.params.id);
      if (!log) return res.status(404).json({ error: 'Log not found' });
      if (String(log.userId) !== String(req.user.id)) return res.status(403).json({ error: 'Forbidden' });
      if (!log.breakStartedAt) return res.status(400).json({ error: 'Break not started' });
      log.breakEndedAt = new Date();
      const duration = (new Date(log.breakEndedAt) - new Date(log.breakStartedAt))/60000; // minutes
      if (!validateBreakDuration(duration)) {
        // Create strike for excessive break
        try {
          await strikeService.createExcessiveBreakStrike(log.userId, log.id, duration);
        } catch (strikeError) {
          console.error('Failed to create excessive break strike:', strikeError);
        }
        return res.status(400).json({ error: 'Break exceeds maximum allowed duration of 30 minutes' });
      }
      await log.save();
      res.json({ data: log });
    } catch (err) { next(err); }
  },

  async getMissedLogs(req, res, next) {
    try {
      const { userId } = req.params;
      // preview missed-log detection only (no writes)
      const detections = await generateMissedLogStrikes(userId, { preview: true });
      res.json({ data: detections });
    } catch (err) { next(err); }
  }
,
  async createMissedLogStrikes(req, res, next) {
    try {
      const { userId } = req.params;
      const sessionId = req.query.sessionId; // Optional: check specific session
      const created = await strikeService.checkAndCreateMissedLogStrikes(userId, sessionId);
      res.json({ data: created });
    } catch (err) { next(err); }
  }
};
