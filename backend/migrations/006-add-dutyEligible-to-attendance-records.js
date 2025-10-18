module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('attendance_records', 'dutyEligible', { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: null });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('attendance_records', 'dutyEligible');
  }
};
