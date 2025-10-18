module.exports = {
  up: async (queryInterface) => {
    const now = new Date();
    const records = [
      { id: 'aaa11111-aaaa-4aaa-8aaa-aaaaaaaa0001', userId: '11111111-1111-4111-8111-111111111111', date: '2025-09-10', status: 'present_in_class', isApproved: true, approvedBy: '33333333-3333-4333-8333-333333333333', approvedAt: now, notes: null, createdAt: now, updatedAt: now },
      { id: 'aaa11111-aaaa-4aaa-8aaa-aaaaaaaa0002', userId: '11111111-1111-4111-8111-111111111112', date: '2025-09-10', status: 'on_club_duty', isApproved: false, approvedBy: null, approvedAt: null, notes: 'Covered event', createdAt: now, updatedAt: now }
    ];
    await queryInterface.bulkInsert('attendance_records', records);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('attendance_records', null, {});
  }
};
