module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('attendance_records', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      userId: { type: Sequelize.UUID, allowNull: false },
      date: { type: Sequelize.DATEONLY, allowNull: false },
      status: { type: Sequelize.ENUM('present_in_class','on_club_duty','absent'), allowNull: false },
      isApproved: { type: Sequelize.BOOLEAN, allowNull: true },
      approvedBy: { type: Sequelize.UUID, allowNull: true },
      approvedAt: { type: Sequelize.DATE, allowNull: true },
      notes: { type: Sequelize.TEXT },
      createdAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') },
      updatedAt: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('now') }
    });
    await queryInterface.addConstraint('attendance_records', {
      fields: ['userId', 'date'],
      type: 'unique',
      name: 'unique_user_date'
    });
    await queryInterface.addIndex('attendance_records', ['date']);
    await queryInterface.addIndex('attendance_records', ['status']);
    await queryInterface.addConstraint('attendance_records', {
      fields: ['userId'],
      type: 'foreign key',
      name: 'fk_attendance_user',
      references: { table: 'users', field: 'id' },
      onDelete: 'cascade',
      onUpdate: 'cascade'
    });
    await queryInterface.addConstraint('attendance_records', {
      fields: ['approvedBy'],
      type: 'foreign key',
      name: 'fk_attendance_approver',
      references: { table: 'users', field: 'id' },
      onDelete: 'set null',
      onUpdate: 'cascade'
    });
  },
  down: async (queryInterface) => {
    await queryInterface.dropTable('attendance_records');
  }
};
