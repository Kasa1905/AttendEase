const bcrypt = require('bcryptjs');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const now = new Date();
    const pwd = await bcrypt.hash('Password123!', 10);
    const users = [
      { id: '11111111-1111-4111-8111-111111111111', email: 'alice.student@example.com', password: pwd, firstName: 'Alice', lastName: 'Student', role: 'student', studentId: 'S1001', department: 'CSE', year: 2, section: 'A', isActive: true, createdAt: now, updatedAt: now },
      { id: '11111111-1111-4111-8111-111111111112', email: 'bob.student@example.com', password: pwd, firstName: 'Bob', lastName: 'Learner', role: 'student', studentId: 'S1002', department: 'ECE', year: 3, section: 'B', isActive: true, createdAt: now, updatedAt: now },
      { id: '22222222-2222-4222-8222-222222222222', email: 'carol.core@example.com', password: pwd, firstName: 'Carol', lastName: 'Core', role: 'core_team', studentId: null, department: 'CSE', year: null, section: null, isActive: true, createdAt: now, updatedAt: now },
      { id: '33333333-3333-4333-8333-333333333333', email: 'dan.teacher@example.com', password: pwd, firstName: 'Dan', lastName: 'Teacher', role: 'teacher', studentId: null, department: 'CSE', year: null, section: null, isActive: true, createdAt: now, updatedAt: now }
    ];
    await queryInterface.bulkInsert('users', users);
  },
  down: async (queryInterface) => {
    await queryInterface.bulkDelete('users', null, {});
  }
};
