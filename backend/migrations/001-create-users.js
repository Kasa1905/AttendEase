module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      password: { type: Sequelize.STRING, allowNull: false },
      firstName: { type: Sequelize.STRING, allowNull: false },
      lastName: { type: Sequelize.STRING, allowNull: false },
      role: { type: Sequelize.ENUM('student','core_team','teacher'), defaultValue: 'student' },
      studentId: { type: Sequelize.STRING, unique: true },
      department: { type: Sequelize.STRING },
      year: { type: Sequelize.INTEGER },
      section: { type: Sequelize.STRING },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
      lastLogin: { type: Sequelize.DATE },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    await queryInterface.addIndex('users', ['email']);
    await queryInterface.addIndex('users', ['studentId']);
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('users');
  }
};
