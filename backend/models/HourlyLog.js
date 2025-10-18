module.exports = (sequelize, DataTypes) => {
  const HourlyLog = sequelize.define('HourlyLog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    dutySessionId: { type: DataTypes.UUID, allowNull: false },
    userId: { type: DataTypes.UUID, allowNull: false },
    logTime: { type: DataTypes.DATE, allowNull: false },
    previousHourWork: { type: DataTypes.TEXT, allowNull: false },
    nextHourPlan: { type: DataTypes.TEXT, allowNull: false },
    isOnBreak: { type: DataTypes.BOOLEAN, defaultValue: false },
    breakStartTime: { type: DataTypes.DATE, allowNull: true },
    breakEndTime: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'hourly_logs',
    indexes: [ { fields: ['dutySessionId'] }, { fields: ['logTime'] } ]
  });

  HourlyLog.associate = (models) => {
    HourlyLog.belongsTo(models.DutySession, { foreignKey: 'dutySessionId' });
    HourlyLog.belongsTo(models.User, { foreignKey: 'userId' });
  };

  return HourlyLog;
};
