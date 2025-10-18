module.exports = (sequelize, DataTypes) => {
  const DutySession = sequelize.define('DutySession', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    eventId: { type: DataTypes.UUID, allowNull: true },
    startTime: { type: DataTypes.DATE, allowNull: false },
    endTime: { type: DataTypes.DATE, allowNull: true },
    totalDuration: { type: DataTypes.INTEGER },
    breakDuration: { type: DataTypes.INTEGER, defaultValue: 0 },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    notes: { type: DataTypes.TEXT }
  }, {
    tableName: 'duty_sessions',
    indexes: [ { fields: ['userId'] }, { fields: ['startTime'] }, { fields: ['isActive'] } ]
  });

  DutySession.associate = (models) => {
    DutySession.belongsTo(models.User, { foreignKey: 'userId' });
    DutySession.belongsTo(models.Event, { foreignKey: 'eventId' });
    DutySession.hasMany(models.HourlyLog, { foreignKey: 'dutySessionId', as: 'HourlyLogs' });
  };

  DutySession.prototype.calculateWorkedMinutes = function () {
    if (!this.startTime || !this.endTime) return null;
    const diffMs = new Date(this.endTime) - new Date(this.startTime);
    const minutes = Math.round(diffMs / 60000) - (this.breakDuration || 0);
    return Math.max(0, minutes);
  };

  // compatibility aliases expected elsewhere in the codebase
  Object.defineProperty(DutySession.prototype, 'startedAt', {
    get() { return this.startTime; },
    enumerable: true
  });
  Object.defineProperty(DutySession.prototype, 'endedAt', {
    get() { return this.endTime; },
    enumerable: true
  });
  Object.defineProperty(DutySession.prototype, 'totalDurationMinutes', {
    get() { return this.totalDuration; },
    enumerable: true
  });

  return DutySession;
};
