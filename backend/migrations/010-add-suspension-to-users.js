module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'suspendedUntil', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Date until which the user is suspended'
    });

    await queryInterface.addColumn('users', 'strikeCount', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false,
      comment: 'Current active strike count for the user'
    });

    await queryInterface.addIndex('users', ['suspendedUntil'], {
      name: 'idx_users_suspended_until'
    });

    await queryInterface.addIndex('users', ['strikeCount'], {
      name: 'idx_users_strike_count'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('users', 'idx_users_strike_count');
    await queryInterface.removeIndex('users', 'idx_users_suspended_until');
    await queryInterface.removeColumn('users', 'strikeCount');
    await queryInterface.removeColumn('users', 'suspendedUntil');
  }
};