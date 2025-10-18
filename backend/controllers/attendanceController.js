const { AttendanceRecord, User, sequelize, DutySession, HourlyLog } = require('../models');
const { Op } = require('sequelize');
const { calculateAttendanceEligibility } = require('../utils/attendanceUtils');
const Joi = require('joi');
const notificationService = require('../services/notificationService');

const markSchema = Joi.object({ userId: Joi.string().guid().required(), date: Joi.date().required(), status: Joi.string().valid('present_in_class', 'on_club_duty', 'absent').required(), notes: Joi.string().allow('', null) });

module.exports = {
  async markAttendance(req, res, next) {
    try {
      const { error } = markSchema.validate(req.body);
      if (error) return res.status(400).json({ error: error.details[0].message });
      const { userId, date, status, notes } = req.body;
      // unique per user-date enforced at DB layer via migrations
      const rec = await AttendanceRecord.create({ userId, date, status, notes });
      // if on_club_duty, create a duty session automatically (if none active)
      if (status === 'on_club_duty') {
        const active = await DutySession.findOne({ where: { userId, endedAt: null } });
        // normalize date only compare
        const provided = new Date(date);
        const today = new Date();
        const providedKey = provided.toISOString().slice(0,10);
        const todayKey = today.toISOString().slice(0,10);
        if (providedKey > todayKey) {
          // future dates: don't auto-create and reject
          return res.status(400).json({ error: 'Cannot auto-create duty session for future-dated attendance' });
        }
        if (!active) {
          if (providedKey === todayKey) {
            await DutySession.create({ userId, startedAt: new Date(), notes: `Auto-created for attendance ${rec.id}` });
          } else {
            // create a backdated ended session matching the provided date with zero duration
            const startedAt = new Date(providedKey + 'T09:00:00Z');
            const endedAt = new Date(providedKey + 'T11:00:00Z');
            await DutySession.create({ userId, startedAt, endedAt, totalDurationMinutes: Math.round((endedAt - startedAt)/60000), notes: `Backdated auto-created for attendance ${rec.id}` });
          }
        }
      }
      // notify user about attendance creation
      try {
        if (notificationService.sendAttendanceUpdateNotification) await notificationService.sendAttendanceUpdateNotification(rec.userId, rec);
        else await notificationService.sendNotification(rec.userId, 'generic', 'Attendance Created', `Status: ${rec.status}`, { date: rec.date });
      } catch (e) { console.error('notify attendance create', e); }

      res.status(201).json({ data: rec });
    } catch (err) { next(err); }
  },

  async validateDutyAttendance(req, res, next) {
    try {
      const { sessionId } = req.body;
      const session = await DutySession.findByPk(sessionId, { include: [{ model: HourlyLog, as: 'HourlyLogs' }] });
      if (!session) return res.status(404).json({ error: 'Session not found' });
      const { meets, total, breaks } = calculateAttendanceEligibility(session);
      res.json({ data: { meets, total, breaks } });
    } catch (err) { next(err); }
  },


    const t = await sequelize.transaction();
    try {
      const { ids } = req.body; // array of attendance record ids
      if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
      const updated = [];
      const notifications = [];

      for (const id of ids) {
        const rec = await AttendanceRecord.findByPk(id, { transaction: t });
        if (!rec) continue;
        // if on club duty, verify duty eligibility before approving
        if (rec.status === 'on_club_duty') {
          // compute day bounds for the attendance date
          const start = new Date(rec.date);
          start.setHours(0, 0, 0, 0);
          const end = new Date(rec.date);
          end.setHours(23, 59, 59, 999);
          // find duty session overlapping that day
          const session = await DutySession.findOne({
            where: {
              userId: rec.userId,
              startedAt: { [Op.lte]: end },
              [Op.or]: [{ endedAt: null }, { endedAt: { [Op.gte]: start } }]
            },
            include: [{ model: HourlyLog, as: 'HourlyLogs' }],
            transaction: t
          });
          let eligible = rec.dutyEligible;
          if (!eligible && session) {
            const calc = calculateAttendanceEligibility(session);
            eligible = calc.meets;
          }
          if (!eligible) {
            // skip and record as not approved
            rec.isApproved = false;
            rec.approvedBy = req.user.id;
            rec.approvedAt = new Date();
            await rec.save({ transaction: t });
            updated.push({ record: rec, error: 'Not eligible for duty approval' });
            continue;
          }
        }
        rec.isApproved = true;
        rec.approvedBy = req.user.id;
        rec.approvedAt = new Date();
        await rec.save({ transaction: t });
        updated.push(rec);
        // accumulate notification
        notifications.push({ userId: rec.userId, record: rec });
      }

      await t.commit();

      // send notifications after commit
      for (const { userId, record } of notifications) {
        try {
          if (notificationService.sendAttendanceUpdateNotification) await notificationService.sendAttendanceUpdateNotification(userId, record);
        } catch (e) { console.error('notify attendance bulk approve', e); }
      }

      res.json({ data: updated });
    } catch (err) {
      await t.rollback();
      next(err);
    }
  },

  async bulkRejectAttendance(req, res, next) {
    const t = await sequelize.transaction();
    try {
      const { ids, reason } = req.body;
      if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
      if (!reason) return res.status(400).json({ error: 'reason is required for rejection' });

      const updated = [];
      const notifications = [];

      for (const id of ids) {
        const rec = await AttendanceRecord.findByPk(id, { transaction: t });
        if (!rec) continue;

        rec.isApproved = false;
        rec.approvedBy = req.user.id;
        rec.approvedAt = new Date();
        rec.notes = (rec.notes ? rec.notes + '; ' : '') + `Rejected: ${reason}`;
        await rec.save({ transaction: t });
        updated.push(rec);

        // accumulate notification
        notifications.push({ userId: rec.userId, record: rec });
      }

      await t.commit();

      // send notifications after commit
      for (const { userId, record } of notifications) {
        try {
          if (notificationService.sendAttendanceUpdateNotification) {
            await notificationService.sendAttendanceUpdateNotification(userId, record);
          }
        } catch (e) { console.error('notify attendance bulk reject', e); }
      }

      res.json({ data: updated });
    } catch (err) {
      await t.rollback();
      next(err);
    }
  },

  async getDailySummary(req, res, next) {
    try {
      const { date } = req.params;
      const targetDate = new Date(date);

      // Compute day bounds
      const start = new Date(targetDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(targetDate);
      end.setHours(23, 59, 59, 999);

      // Get attendance records for the date
      const attendanceRecords = await AttendanceRecord.findAll({
        where: { date: { [Op.between]: [start, end] } },
        include: [
          { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'studentId'] },
          { model: DutySession, include: [{ model: HourlyLog, as: 'HourlyLogs' }] }
        ]
      });

      // Get duty sessions overlapping the date
      const dutySessions = await DutySession.findAll({
        where: {
          startedAt: { [Op.lte]: end },
          [Op.or]: [{ endedAt: null }, { endedAt: { [Op.gte]: start } }]
        },
        include: [
          { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'studentId'] },
          { model: HourlyLog, as: 'HourlyLogs' }
        ]
      });

      // Get hourly logs for the date
      const hourlyLogs = await HourlyLog.findAll({
        where: { createdAt: { [Op.between]: [start, end] } },
        include: [
          { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'studentId'] },
          { model: DutySession }
        ]
      });

      res.json({
        data: {
          date: targetDate,
          attendanceRecords,
          dutySessions,
          hourlyLogs,
          summary: {
            totalAttendance: attendanceRecords.length,
            approvedAttendance: attendanceRecords.filter(r => r.isApproved).length,
            pendingApproval: attendanceRecords.filter(r => r.isApproved === null).length,
            totalDutySessions: dutySessions.length,
            completedDutySessions: dutySessions.filter(s => s.endedAt).length,
            totalHourlyLogs: hourlyLogs.length
          }
        }
      });
    } catch (err) { next(err); }
  },

  async getPendingApproval(req, res, next) {
    try {
      const { page = 1, pageSize = 20, dateFrom, dateTo, studentId } = req.query;
      const where = { isApproved: null }; // null means pending

      if (dateFrom || dateTo) {
        where.date = {};
        if (dateFrom) where.date[Op.gte] = new Date(dateFrom);
        if (dateTo) where.date[Op.lte] = new Date(dateTo);
      }

      if (studentId) where.userId = studentId;

      const offset = (page - 1) * pageSize;
      const { count, rows } = await AttendanceRecord.findAndCountAll({
        where,
        include: [
          { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'studentId'] },
          { model: DutySession, include: [{ model: HourlyLog, as: 'HourlyLogs' }] }
        ],
        order: [['date', 'DESC'], ['createdAt', 'DESC']],
        limit: pageSize,
        offset
      });

      res.json({
        data: rows,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        total: count
      });
    } catch (err) { next(err); }
  },

  async getAttendanceWithDetails(req, res, next) {
    try {
      const { id } = req.params;
      const record = await AttendanceRecord.findByPk(id, {
        include: [
          { model: User, attributes: ['id', 'firstName', 'lastName', 'email', 'studentId'] },
          {
            model: DutySession,
            include: [{ model: HourlyLog, as: 'HourlyLogs' }]
          }
        ]
      });

      if (!record) return res.status(404).json({ error: 'Attendance record not found' });

      // Calculate eligibility if on club duty
      let eligibility = null;
      if (record.status === 'on_club_duty' && record.DutySession) {
        eligibility = calculateAttendanceEligibility(record.DutySession);
      }

      res.json({
        data: {
          ...record.toJSON(),
          eligibility
        }
      });
    } catch (err) { next(err); }
  },

  async getAttendanceByUser(req, res, next) {
    try {
      const { userId } = req.params;
      const records = await AttendanceRecord.findAll({ where: { userId }, include: [{ model: User, attributes: ['id', 'firstName', 'lastName'] }] });
      res.json({ data: records });
    } catch (err) { next(err); }
  },

  async getAttendanceByDate(req, res, next) {
    try {
      const { date } = req.params;
      const records = await AttendanceRecord.findAll({ where: { date }, include: [{ model: User, attributes: ['id', 'firstName', 'lastName'] }] });
      res.json({ data: records });
    } catch (err) { next(err); }
  },

  async updateAttendanceStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { isApproved } = req.body;
      const rec = await AttendanceRecord.findByPk(id);
      if (!rec) return res.status(404).json({ error: 'Record not found' });
      // if approving an on_club_duty record, verify duty eligibility
      if (isApproved && rec.status === 'on_club_duty') {
        let eligible = rec.dutyEligible;
        if (!eligible) {
          // compute day bounds for the attendance date
          const start = new Date(rec.date);
          start.setHours(0, 0, 0, 0);
          const end = new Date(rec.date);
          end.setHours(23, 59, 59, 999);
          // find duty session overlapping that day
          const session = await DutySession.findOne({
            where: {
              userId: rec.userId,
              startedAt: { [Op.lte]: end },
              [Op.or]: [{ endedAt: null }, { endedAt: { [Op.gte]: start } }]
            },
            include: [{ model: HourlyLog, as: 'HourlyLogs' }]
          });
          if (session) {
            const calc = calculateAttendanceEligibility(session);
            eligible = calc.meets;
          }
        }
        if (!eligible) return res.status(400).json({ error: 'Attendance not eligible for approval based on duty rules' });
      }
      rec.isApproved = isApproved;
      rec.approvedBy = req.user.id;
      rec.approvedAt = new Date();
      // If rejecting, append reason to notes
      if (!isApproved && req.body.reason) {
        rec.notes = (rec.notes ? rec.notes + '; ' : '') + `Rejected: ${req.body.reason}`;
      }
      await rec.save();
      // notify user about attendance status update
      try {
        if (notificationService.sendAttendanceUpdateNotification) await notificationService.sendAttendanceUpdateNotification(rec.userId, rec);
      } catch (e) { console.error('notify attendance update', e); }
      res.json({ data: rec });
    } catch (err) { next(err); }
  },

  async getAttendanceStats(req, res, next) {
    try {
      const stats = await sequelize.query(
        `SELECT status, count(*) as count FROM attendance_records GROUP BY status;`,
        { type: sequelize.QueryTypes.SELECT }
      );
      res.json({ data: stats });
    } catch (err) { next(err); }
  }
};
