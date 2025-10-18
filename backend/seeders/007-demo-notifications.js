module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const notifications = [
      // Alice (student) notifications
      { id: Sequelize.literal('gen_random_uuid()'), userId: '11111111-1111-4111-8111-111111111111', type: 'hourly_reminder', title: 'Hourly Reminder', message: 'Time to log your hourly work for session XYZ', data: { sessionId: 'session-123' }, isRead: false, readAt: null, createdAt: now, updatedAt: now },
      { id: Sequelize.literal('gen_random_uuid()'), userId: '11111111-1111-4111-8111-111111111111', type: 'request_approved', title: 'Request Approved', message: 'Your leave request for 2025-09-20 was approved.', data: { requestId: 'req-456' }, isRead: true, readAt: yesterday, createdAt: yesterday, updatedAt: yesterday },
      { id: Sequelize.literal('gen_random_uuid()'), userId: '11111111-1111-4111-8111-111111111111', type: 'generic', title: 'Welcome', message: 'Welcome to the Club Attendance System!', data: {}, isRead: true, readAt: twoDaysAgo, createdAt: twoDaysAgo, updatedAt: twoDaysAgo },

      // Bob (student) notifications
      { id: Sequelize.literal('gen_random_uuid()'), userId: '11111111-1111-4111-8111-111111111112', type: 'request_rejected', title: 'Request Rejected', message: 'Your request for 2025-09-21 was rejected: Insufficient reason.', data: { requestId: 'req-789' }, isRead: false, readAt: null, createdAt: now, updatedAt: now },
      { id: Sequelize.literal('gen_random_uuid()'), userId: '11111111-1111-4111-8111-111111111112', type: 'duty_session_reminder', title: 'Duty Session Started', message: 'Your duty session has started. We\'ll remind you hourly.', data: { sessionId: 'session-456' }, isRead: true, readAt: yesterday, createdAt: yesterday, updatedAt: yesterday },
      { id: Sequelize.literal('gen_random_uuid()'), userId: '11111111-1111-4111-8111-111111111112', type: 'strike_warning', title: 'Strike Warning', message: 'You have received a strike for missing attendance.', data: { strikeId: 'strike-101' }, isRead: false, readAt: null, createdAt: lastWeek, updatedAt: lastWeek },

      // Carol (core_team) notifications
      { id: Sequelize.literal('gen_random_uuid()'), userId: '22222222-2222-4222-8222-222222222222', type: 'generic', title: 'New Leave Request', message: 'New leave request from Alice Student for 2025-09-20', data: { requestId: 'req-456' }, isRead: false, readAt: null, createdAt: now, updatedAt: now },
      { id: Sequelize.literal('gen_random_uuid()'), userId: '22222222-2222-4222-8222-222222222222', type: 'request_approved', title: 'Request Approved', message: 'You approved Bob\'s request for 2025-09-21', data: { requestId: 'req-789' }, isRead: true, readAt: yesterday, createdAt: yesterday, updatedAt: yesterday },
      { id: Sequelize.literal('gen_random_uuid()'), userId: '22222222-2222-4222-8222-222222222222', type: 'duty_session_reminder', title: 'Duty Session Ended', message: 'Duty session ended. Total: 120 mins', data: { sessionId: 'session-456', eligible: true }, isRead: true, readAt: twoDaysAgo, createdAt: twoDaysAgo, updatedAt: twoDaysAgo },

      // Dan (teacher) notifications
      { id: Sequelize.literal('gen_random_uuid()'), userId: '33333333-3333-4333-8333-333333333333', type: 'hourly_reminder', title: 'Hourly Reminder', message: 'Time to log your hourly work for session ABC', data: { sessionId: 'session-789' }, isRead: false, readAt: null, createdAt: now, updatedAt: now },
      { id: Sequelize.literal('gen_random_uuid()'), userId: '33333333-3333-4333-8333-333333333333', type: 'generic', title: 'System Update', message: 'The system has been updated with new features.', data: {}, isRead: true, readAt: lastWeek, createdAt: lastWeek, updatedAt: lastWeek },
      { id: Sequelize.literal('gen_random_uuid()'), userId: '33333333-3333-4333-8333-333333333333', type: 'strike_warning', title: 'Strike Issued', message: 'A strike has been issued to Bob Learner.', data: { strikeId: 'strike-102' }, isRead: false, readAt: null, createdAt: twoDaysAgo, updatedAt: twoDaysAgo }
    ];

    await queryInterface.bulkInsert('Notifications', notifications);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('Notifications', null, {});
  }
};