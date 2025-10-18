module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('hourly_logs', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      dutySessionId: { type: Sequelize.UUID, allowNull: false },
      userId: { type: Sequelize.UUID, allowNull: false },
      logTime: { type: Sequelize.DATE, allowNull: false },
      previousHourWork: { type: Sequelize.TEXT, allowNull: false },
      nextHourPlan: { type: Sequelize.TEXT, allowNull: false },
      isOnBreak: { type: Sequelize.BOOLEAN, defaultValue: false },
      breakStartTime: { type: Sequelize.DATE, allowNull: true },
      breakEndTime: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    await queryInterface.addIndex('hourly_logs', ['dutySessionId']);
    await queryInterface.addIndex('hourly_logs', ['logTime']);
    await queryInterface.addConstraint('hourly_logs', {
      fields: ['dutySessionId'],
      type: 'foreign key',
      name: 'fk_hourly_duty',
      references: { table: 'duty_sessions', field: 'id' },
      onDelete: 'cascade',
      onUpdate: 'cascade'
    });
    await queryInterface.addConstraint('hourly_logs', {
      fields: ['userId'],
      type: 'foreign key',
      name: 'fk_hourly_user',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
      onUpdate: 'cascade'
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('hourly_logs');
  }
};
