const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ImportHistory = sequelize.define('ImportHistory', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    batchId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    requestedBy: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: false
    },
    format: {
      type: DataTypes.ENUM('csv', 'xlsx'),
      allowNull: false
    },
    totalRows: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    successful: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    failed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    errorCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false
    },
    finishedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    duration: {
      type: DataTypes.INTEGER, // in milliseconds
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('processing', 'completed', 'failed', 'cancelled'),
      allowNull: false,
      defaultValue: 'processing'
    },
    sampleErrors: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: []
    },
    errorSummary: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    timestamps: true,
    indexes: [
      {
        fields: ['batchId']
      },
      {
        fields: ['requestedBy']
      },
      {
        fields: ['status']
      },
      {
        fields: ['startedAt']
      }
    ]
  });

  ImportHistory.associate = (models) => {
    ImportHistory.belongsTo(models.User, {
      foreignKey: 'requestedBy',
      as: 'requester'
    });
  };

  return ImportHistory;
};