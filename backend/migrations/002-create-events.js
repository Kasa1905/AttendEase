module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('events', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      name: { type: Sequelize.STRING, allowNull: false },
      description: { type: Sequelize.TEXT },
      eventDate: { type: Sequelize.DATEONLY, allowNull: false },
      startTime: { type: Sequelize.TIME },
      endTime: { type: Sequelize.TIME },
      location: { type: Sequelize.STRING },
      eventType: { type: Sequelize.ENUM('meeting','workshop','competition','social','other') },
      isActive: { type: Sequelize.BOOLEAN, defaultValue: true },
      createdBy: { type: Sequelize.UUID, allowNull: false },
      maxParticipants: { type: Sequelize.INTEGER },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    await queryInterface.addIndex('events', ['eventDate']);
    await queryInterface.addIndex('events', ['eventType']);
    await queryInterface.addConstraint('events', {
      fields: ['createdBy'],
      type: 'foreign key',
      name: 'fk_events_createdBy_users',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
      onUpdate: 'cascade'
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('events');
  }
};
