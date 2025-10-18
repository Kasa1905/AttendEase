module.exports = (sequelize, DataTypes) => {
  const AttendanceRecord = sequelize.define('AttendanceRecord', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    status: { type: DataTypes.ENUM('present_in_class', 'on_club_duty', 'absent'), allowNull: false },
  isApproved: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: null },
  // whether this attendance record (for on_club_duty) meets duty eligibility rules
  dutyEligible: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: null },
    approvedBy: { type: DataTypes.UUID, allowNull: true },
    approvedAt: { type: DataTypes.DATE, allowNull: true },
    notes: { type: DataTypes.TEXT }
  }, {
    tableName: 'attendance_records',
    indexes: [
      { fields: ['date'] },
      { fields: ['status'] }
    ],
    hooks: {}
  });

  AttendanceRecord.associate = (models) => {
    AttendanceRecord.belongsTo(models.User, { foreignKey: 'userId' });
    AttendanceRecord.belongsTo(models.User, { foreignKey: 'approvedBy', as: 'approver' });
  };

  return AttendanceRecord;
};
