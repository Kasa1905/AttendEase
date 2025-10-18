module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('duty_sessions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false },
      eventId: { type: Sequelize.UUID, allowNull: true },
      startTime: { type: Sequelize.DATE, allowNull: false },
      endTime: { type: Sequelize.DATE, allowNull: true },
      totalDuration: { type: Sequelize.INTEGER },
      breakDuration: { type: Sequelize.INTEGER, defaultValue: 0 },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
      notes: { type: Sequelize.TEXT },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    await queryInterface.addIndex('duty_sessions', ['userId']);
    await queryInterface.addIndex('duty_sessions', ['startTime']);
    await queryInterface.addIndex('duty_sessions', ['isActive']);
    await queryInterface.addConstraint('duty_sessions', {
      fields: ['userId'],
      type: 'foreign key',
      name: 'fk_duty_user',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
      onUpdate: 'cascade'
    });
    await queryInterface.addConstraint('duty_sessions', {
      fields: ['eventId'],
      type: 'foreign key',
      name: 'fk_duty_event',
      references: { table: 'events', field: 'id' },
      onDelete: 'set null',
      onUpdate: 'cascade'
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('duty_sessions');
  }
};
