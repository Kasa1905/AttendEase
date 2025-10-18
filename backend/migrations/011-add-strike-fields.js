module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('strikes', 'strikeCountAtTime', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1
    });

    await queryInterface.addColumn('strikes', 'resolutionNotes', {
      type: Sequelize.TEXT,
      allowNull: true
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('strikes', 'strikeCountAtTime');
    await queryInterface.removeColumn('strikes', 'resolutionNotes');
  }
};