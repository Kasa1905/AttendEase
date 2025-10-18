'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ImportHistories', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
        allowNull: false
      },
      batchId: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true
      },
      requestedBy: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'Users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      fileName: {
        type: Sequelize.STRING,
        allowNull: false
      },
      format: {
        type: Sequelize.ENUM('csv', 'xlsx'),
        allowNull: false
      },
      totalRows: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      successful: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      failed: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      errorCount: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      startedAt: {
        type: Sequelize.DATE,
        allowNull: false
      },
      finishedAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      status: {
        type: Sequelize.ENUM('processing', 'completed', 'failed', 'cancelled'),
        allowNull: false,
        defaultValue: 'processing'
      },
      sampleErrors: {
        type: Sequelize.JSON,
        allowNull: true,
        defaultValue: []
      },
      errorSummary: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add indexes
    await queryInterface.addIndex('ImportHistories', ['batchId']);
    await queryInterface.addIndex('ImportHistories', ['requestedBy']);
    await queryInterface.addIndex('ImportHistories', ['status']);
    await queryInterface.addIndex('ImportHistories', ['startedAt']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ImportHistories');
  }
};