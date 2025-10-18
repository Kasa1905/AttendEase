const { DutySession, User } = require('../models');

module.exports = {
  async up(queryInterface, Sequelize) {
    const users = await User.findAll({ limit: 5 });
    const sessions = [];
    const now = new Date();
    for (let i=0;i<users.length;i++){
      const u = users[i];
      // create a 3-hour session two days ago
      const startedAt = new Date(now.getTime() - (2*24*60*60*1000) + i*60000);
      const endedAt = new Date(startedAt.getTime() + (3*60*60*1000));
      sessions.push({ userId: u.id, startedAt, endedAt, totalDurationMinutes: 180, notes: 'Demo session' });
    }
    // add an under-2h session (90 minutes)
    if (users[0]) {
      const sStart = new Date(now.getTime() - (24*60*60*1000));
      const sEnd = new Date(sStart.getTime() + 90*60000);
      sessions.push({ userId: users[0].id, startedAt: sStart, endedAt: sEnd, totalDurationMinutes: 90, notes: 'Short session (under 2h)' });
    }
    // add a session with short break (<=30)
    if (users[1]) {
      const sStart = new Date(now.getTime() - (3*24*60*60*1000));
      const sEnd = new Date(sStart.getTime() + 3*60*60*1000);
      sessions.push({ userId: users[1].id, startedAt: sStart, endedAt: sEnd, totalDurationMinutes: 170, notes: 'Session with short break' });
    }
    // add a session with long break (>30)
    if (users[2]) {
      const sStart = new Date(now.getTime() - (4*24*60*60*1000));
      const sEnd = new Date(sStart.getTime() + 4*60*60*1000);
      sessions.push({ userId: users[2].id, startedAt: sStart, endedAt: sEnd, totalDurationMinutes: 210, notes: 'Session with long break' });
    }
    // add an active session (no endedAt)
    if (users[3]) {
      const sStart = new Date(now.getTime() - 30*60000);
      sessions.push({ userId: users[3].id, startedAt: sStart, endedAt: null, totalDurationMinutes: null, notes: 'Active session' });
    }
    await queryInterface.bulkInsert('duty_sessions', sessions.map(s => ({ userId: s.userId, startedAt: s.startedAt, endedAt: s.endedAt, totalDurationMinutes: s.totalDurationMinutes, notes: s.notes, createdAt: new Date(), updatedAt: new Date() })), {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('duty_sessions', { notes: 'Demo session' }, {});
  }
};
