const { HourlyLog, DutySession, Strike } = require('../models');
const strikeService = require('../services/strikeService');

function msToMinutes(ms) { return Math.round(ms / 60000); }

module.exports = {
  calculateDutyDuration(session) {
    // calculate elapsed minutes between startedAt and now/end, minus breaks recorded in hourly logs
    const end = session.endedAt ? new Date(session.endedAt) : new Date();
    const start = new Date(session.startedAt);
    let total = msToMinutes(end - start);
    // subtract breaks
    if (session.HourlyLogs && session.HourlyLogs.length) {
      for (const log of session.HourlyLogs) {
        if (log.breakStartedAt && log.breakEndedAt) {
          total -= msToMinutes(new Date(log.breakEndedAt) - new Date(log.breakStartedAt));
        }
      }
    }
    return total;
  },

  validateMinimumDutyHours(totalMinutes, minMinutes = 120) {
    return totalMinutes >= minMinutes;
  },

  validateBreakDuration(minutes) {
    return minutes <= 30;
  },

  async generateMissedLogStrikes(userId) {
    // backward compatible signature: generateMissedLogStrikes(userId, options)
    const options = arguments[1] || {};
    const sessions = await DutySession.findAll({ where: { userId } });
    const results = [];
    for (const s of sessions) {
      const logs = await HourlyLog.findAll({ where: { dutySessionId: s.id }, order: [['createdAt','ASC']] });
      for (let i = 0; i < logs.length - 1; i++) {
        const gap = msToMinutes(new Date(logs[i+1].createdAt) - new Date(logs[i].createdAt));
        if (gap > 90) {
          if (options.preview) {
            results.push({ userId, sessionId: s.id, gap, reason: 'missed_hourly_log' });
          } else {
            await strikeService.checkAndCreateMissedLogStrikes(userId, s.id);
            results.push({ userId, sessionId: s.id, gap, reason: 'missed_hourly_log' });
          }
        }
      }
    }
    return results;
  },

  isWithinLogWindow(session) {
    // simple heuristic: allow logs only within session startedAt..endedAt or up to 2 hours after
    const now = new Date();
    const start = new Date(session.startedAt);
    const end = session.endedAt ? new Date(session.endedAt) : new Date();
    const allowedUntil = new Date((session.endedAt ? end : now).getTime() + 2 * 60 * 60 * 1000);
    return now >= start && now <= allowedUntil;
  },

  validateLogTiming(session, proposedTime = new Date(), windowMinutes = 15) {
    // enforce hourly cadence: next log should be within +/- windowMinutes around expected time
    // expected time = last log createdAt + 1h, or session.startedAt + 1h if no logs
    const expectedAsync = (async () => {
      const logs = await HourlyLog.findAll({ where: { dutySessionId: session.id }, order: [['createdAt','ASC']] });
      let expected;
      if (!logs.length) expected = new Date(new Date(session.startedAt).getTime() + 60*60*1000);
      else expected = new Date(new Date(logs[logs.length-1].createdAt).getTime() + 60*60*1000);
      const low = new Date(expected.getTime() - windowMinutes*60000);
      const high = new Date(expected.getTime() + windowMinutes*60000);
      return proposedTime >= low && proposedTime <= high;
    })();
    // return boolean (Note: caller may be sync; resolve promise here)
    return expectedAsync;
  },

  calculateAttendanceEligibility(session) {
    const total = this.calculateDutyDuration(session);
    const breaks = this.calculateBreakTime(session);
    const meets = this.validateMinimumDutyHours(total, 120);
    return { meets, total, breaks };
  },

  formatDutySessionSummary(session) {
    return {
      id: session.id,
      userId: session.userId,
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      totalDurationMinutes: session.totalDurationMinutes || this.calculateDutyDuration(session)
    };
  },

  validateDutySessionTiming(session) {
    if (!session.startedAt) throw new Error('Session missing start time');
    if (session.endedAt && new Date(session.endedAt) < new Date(session.startedAt)) throw new Error('End before start');
    return true;
  },

  calculateBreakTime(session) {
    let total = 0;
    if (session.HourlyLogs && session.HourlyLogs.length) {
      for (const log of session.HourlyLogs) {
        if (log.breakStartedAt && log.breakEndedAt) total += msToMinutes(new Date(log.breakEndedAt) - new Date(log.breakStartedAt));
      }
    }
    return total;
  },

  getNextLogDueTime(session) {
    // next log due one hour after last hourly log or one hour after start
    return (async () => {
      const logs = await HourlyLog.findAll({ where: { dutySessionId: session.id }, order: [['createdAt','ASC']] });
      if (!logs.length) return new Date(new Date(session.startedAt).getTime() + 60*60*1000);
      const last = logs[logs.length-1];
      return new Date(new Date(last.createdAt).getTime() + 60*60*1000);
    })();
  }
};
