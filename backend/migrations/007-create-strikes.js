module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('strikes', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false },
      reason: { type: Sequelize.ENUM('missed_hourly_log','insufficient_duty_hours','excessive_break','other') },
      description: { type: Sequelize.TEXT },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
      resolvedBy: { type: Sequelize.UUID, allowNull: true },
      resolvedAt: { type: Sequelize.DATE, allowNull: true },
      severity: { type: Sequelize.ENUM('warning','minor','major'), defaultValue: 'minor' },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    await queryInterface.addIndex('strikes', ['userId']);
    await queryInterface.addIndex('strikes', ['date']);
    await queryInterface.addIndex('strikes', ['isActive']);
    await queryInterface.addConstraint('strikes', {
      fields: ['userId'],
      type: 'foreign key',
      name: 'fk_strike_user',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
      onUpdate: 'cascade'
    });
    await queryInterface.addConstraint('strikes', {
      fields: ['resolvedBy'],
      type: 'foreign key',
      name: 'fk_strike_resolver',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
      onUpdate: 'cascade'
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('strikes');
  }
};
