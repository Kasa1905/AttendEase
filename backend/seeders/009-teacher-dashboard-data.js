module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(now.getDate() - 2);

    // Additional attendance records for teacher dashboard testing
    const attendanceRecords = [
      // Pending approvals
      { id: 'aaa11111-aaaa-4aaa-8aaa-aaaaaaaa0003', userId: '11111111-1111-4111-8111-111111111111', date: yesterday, status: 'present_in_class', isApproved: null, approvedBy: null, approvedAt: null, notes: null, dutyEligible: false, createdAt: yesterday, updatedAt: yesterday },
      { id: 'aaa11111-aaaa-4aaa-8aaa-aaaaaaaa0004', userId: '11111111-1111-4111-8111-111111111112', date: yesterday, status: 'on_club_duty', isApproved: null, approvedBy: null, approvedAt: null, notes: 'Helped with setup', dutyEligible: true, createdAt: yesterday, updatedAt: yesterday },
      { id: 'aaa11111-aaaa-4aaa-8aaa-aaaaaaaa0005', userId: '11111111-1111-4111-8111-111111111111', date: twoDaysAgo, status: 'absent', isApproved: null, approvedBy: null, approvedAt: null, notes: 'Sick leave', dutyEligible: false, createdAt: twoDaysAgo, updatedAt: twoDaysAgo },
      // Approved records
      { id: 'aaa11111-aaaa-4aaa-8aaa-aaaaaaaa0006', userId: '11111111-1111-4111-8111-111111111112', date: twoDaysAgo, status: 'present_in_class', isApproved: true, approvedBy: '33333333-3333-4333-8333-333333333333', approvedAt: now, notes: null, dutyEligible: false, createdAt: twoDaysAgo, updatedAt: now },
      // Rejected records
      { id: 'aaa11111-aaaa-4aaa-8aaa-aaaaaaaa0007', userId: '11111111-1111-4111-8111-111111111111', date: now, status: 'on_club_duty', isApproved: false, approvedBy: '33333333-3333-4333-8333-333333333333', approvedAt: now, notes: 'Rejected: Insufficient duty time', dutyEligible: false, createdAt: now, updatedAt: now }
    ];

    // Duty sessions
    const dutySessions = [
      { id: 'ddd11111-dddd-4ddd-8ddd-dddddddd0003', userId: '11111111-1111-4111-8111-111111111112', startedAt: new Date(yesterday.getTime() + 9 * 60 * 60 * 1000), endedAt: new Date(yesterday.getTime() + 12 * 60 * 60 * 1000), totalDurationMinutes: 180, notes: 'Event preparation', eventId: null, createdAt: yesterday, updatedAt: yesterday },
      { id: 'ddd11111-dddd-4ddd-8ddd-dddddddd0004', userId: '11111111-1111-4111-8111-111111111111', startedAt: new Date(now.getTime() + 10 * 60 * 60 * 1000), endedAt: null, totalDurationMinutes: null, notes: 'Ongoing duty', eventId: null, createdAt: now, updatedAt: now }
    ];

    // Hourly logs
    const hourlyLogs = [
      { id: 'hhh11111-hhhh-4hhh-8hhh-hhhhhhhh0003', sessionId: 'ddd11111-dddd-4ddd-8ddd-dddddddd0003', previousHourWork: 'Set up tables and chairs for the event', nextHourPlan: 'Welcome guests and manage registration', createdAt: new Date(yesterday.getTime() + 10 * 60 * 60 * 1000), updatedAt: new Date(yesterday.getTime() + 10 * 60 * 60 * 1000) },
      { id: 'hhh11111-hhhh-4hhh-8hhh-hhhhhhhh0004', sessionId: 'ddd11111-dddd-4ddd-8ddd-dddddddd0003', previousHourWork: 'Managed registration and welcomed guests', nextHourPlan: 'Clean up after event', createdAt: new Date(yesterday.getTime() + 11 * 60 * 60 * 1000), updatedAt: new Date(yesterday.getTime() + 11 * 60 * 60 * 1000) },
      { id: 'hhh11111-hhhh-4hhh-8hhh-hhhhhhhh0005', sessionId: 'ddd11111-dddd-4ddd-8ddd-dddddddd0004', previousHourWork: 'Started duty session', nextHourPlan: 'Continue with assigned tasks', createdAt: new Date(now.getTime() + 10 * 60 * 60 * 1000), updatedAt: new Date(now.getTime() + 10 * 60 * 60 * 1000) }
    ];

    await queryInterface.bulkInsert('attendance_records', attendanceRecords);
    await queryInterface.bulkInsert('duty_sessions', dutySessions);
    await queryInterface.bulkInsert('hourly_logs', hourlyLogs);
  },

  down: async (queryInterface) => {
    await queryInterface.bulkDelete('hourly_logs', { id: { [queryInterface.sequelize.Op.in]: ['hhh11111-hhhh-4hhh-8hhh-hhhhhhhh0003', 'hhh11111-hhhh-4hhh-8hhh-hhhhhhhh0004', 'hhh11111-hhhh-4hhh-8hhh-hhhhhhhh0005'] } }, {});
    await queryInterface.bulkDelete('duty_sessions', { id: { [queryInterface.sequelize.Op.in]: ['ddd11111-dddd-4ddd-8ddd-dddddddd0003', 'ddd11111-dddd-4ddd-8ddd-dddddddd0004'] } }, {});
    await queryInterface.bulkDelete('attendance_records', { id: { [queryInterface.sequelize.Op.in]: ['aaa11111-aaaa-4aaa-8aaa-aaaaaaaa0003', 'aaa11111-aaaa-4aaa-8aaa-aaaaaaaa0004', 'aaa11111-aaaa-4aaa-8aaa-aaaaaaaa0005', 'aaa11111-aaaa-4aaa-8aaa-aaaaaaaa0006', 'aaa11111-aaaa-4aaa-8aaa-aaaaaaaa0007'] } }, {});
  }
};