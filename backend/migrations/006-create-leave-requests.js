module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('leave_requests', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false },
      requestType: { type: Sequelize.ENUM('leave','club_duty'), allowNull: false },
      requestDate: { type: Sequelize.DATEONLY, allowNull: false },
      reason: { type: Sequelize.TEXT, allowNull: false },
      status: { type: Sequelize.ENUM('pending','approved','rejected'), defaultValue: 'pending' },
      approvedBy: { type: Sequelize.UUID, allowNull: true },
      approvedAt: { type: Sequelize.DATE, allowNull: true },
      rejectionReason: { type: Sequelize.TEXT },
      submittedAt: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    await queryInterface.addIndex('leave_requests', ['userId']);
    await queryInterface.addIndex('leave_requests', ['requestDate']);
    await queryInterface.addIndex('leave_requests', ['status']);
    await queryInterface.addConstraint('leave_requests', {
      fields: ['userId'],
      type: 'foreign key',
      name: 'fk_leave_user',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
      onUpdate: 'cascade'
    });
    await queryInterface.addConstraint('leave_requests', {
      fields: ['approvedBy'],
      type: 'foreign key',
      name: 'fk_leave_approver',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
      onUpdate: 'cascade'
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('leave_requests');
  }
};
