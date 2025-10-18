const { LeaveRequest } = require('../models');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();
    const demo = [];
    for (let i = 1; i <= 15; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      demo.push({
        userId: (i % 5) + 1,
        requestType: i % 2 === 0 ? 'leave' : 'club_duty',
        requestDate: d.toISOString().slice(0,10),
        reason: `Demo request ${i}`,
        status: i % 6 === 0 ? 'approved' : (i % 5 === 0 ? 'rejected' : 'pending'),
        submittedAt: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 8, 30),
        approvedBy: i % 6 === 0 ? 1 : null,
        approvedAt: i % 6 === 0 ? new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10, 0) : null,
        rejectionReason: i % 5 === 0 ? 'Scheduling conflict' : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    await queryInterface.bulkInsert('LeaveRequests', demo);
  },
  down: async (queryInterface, Sequelize) => {
    await queryInterface.bulkDelete('LeaveRequests', null, {});
  }
};
