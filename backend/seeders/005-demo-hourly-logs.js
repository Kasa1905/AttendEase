const { HourlyLog, DutySession } = require('../models');

module.exports = {
  async up(queryInterface, Sequelize) {
    const sessions = await DutySession.findAll({ limit: 10 });
    const logs = [];
    for (const s of sessions) {
      const start = new Date(s.startedAt);
      for (let h=0; h< Math.max(1, Math.floor((s.totalDurationMinutes || 180)/60)); h++) {
        const createdAt = new Date(start.getTime() + h*60*60*1000 + 5*60000);
        logs.push({ dutySessionId: s.id, userId: s.userId, previousHourWork: `Work for hour ${h+1}`, nextHourPlan: `Plan ${h+2}`, createdAt, updatedAt: new Date() });
      }
    }
    // add edge-case logs: for short session, one log only
    const shortSession = sessions.find(s => s.totalDurationMinutes && s.totalDurationMinutes < 120);
    if (shortSession) {
      const createdAt = new Date(shortSession.startedAt.getTime() + 30*60000);
      logs.push({ dutySessionId: shortSession.id, userId: shortSession.userId, previousHourWork: `Short session work`, nextHourPlan: `N/A`, createdAt, updatedAt: new Date() });
    }
    // add break markers: for second user, create a log with break <=30
    const shortBreakSession = sessions.find(s => s.notes && s.notes.includes('short break'));
    if (shortBreakSession) {
      const base = new Date(shortBreakSession.startedAt.getTime() + 60*60000);
      const l = { dutySessionId: shortBreakSession.id, userId: shortBreakSession.userId, previousHourWork: 'Hour 1', nextHourPlan: 'Hour 2', createdAt: base, updatedAt: new Date(), breakStartedAt: new Date(base.getTime() + 15*60000), breakEndedAt: new Date(base.getTime() + 40*60000) };
      logs.push(l);
    }
    // for third user, create a long break >30
    const longBreakSession = sessions.find(s => s.notes && s.notes.includes('long break'));
    if (longBreakSession) {
      const base = new Date(longBreakSession.startedAt.getTime() + 2*60*60000);
      const l = { dutySessionId: longBreakSession.id, userId: longBreakSession.userId, previousHourWork: 'Hour 2', nextHourPlan: 'Hour 3', createdAt: base, updatedAt: new Date(), breakStartedAt: new Date(base.getTime() + 10*60000), breakEndedAt: new Date(base.getTime() + 60*60000) };
      logs.push(l);
    }
    // missing logs: create a gap >90 minutes between two consecutive logs for another session
    const gapSession = sessions.find(s => s.notes && s.notes.includes('Demo session'));
    if (gapSession) {
      const base = new Date(gapSession.startedAt.getTime());
      const l1 = { dutySessionId: gapSession.id, userId: gapSession.userId, previousHourWork: 'Hour 1', nextHourPlan: 'Hour 2', createdAt: base, updatedAt: new Date() };
      const l2 = { dutySessionId: gapSession.id, userId: gapSession.userId, previousHourWork: 'Hour 3', nextHourPlan: 'Hour 4', createdAt: new Date(base.getTime() + 3*60*60000), updatedAt: new Date() }; // 3 hours later -> gap>90
      logs.push(l1, l2);
    }
    await queryInterface.bulkInsert('hourly_logs', logs, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('hourly_logs', null, {});
  }
};
