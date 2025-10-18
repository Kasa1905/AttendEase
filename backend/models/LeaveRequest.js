module.exports = (sequelize, DataTypes) => {
  const LeaveRequest = sequelize.define('LeaveRequest', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    requestType: { type: DataTypes.ENUM('leave', 'club_duty'), allowNull: false },
    requestDate: { type: DataTypes.DATEONLY, allowNull: false },
    reason: { type: DataTypes.TEXT, allowNull: false },
    status: { type: DataTypes.ENUM('pending', 'approved', 'rejected'), defaultValue: 'pending' },
    approvedBy: { type: DataTypes.UUID, allowNull: true },
    approvedAt: { type: DataTypes.DATE, allowNull: true },
    rejectionReason: { type: DataTypes.TEXT },
    submittedAt: { type: DataTypes.DATE, allowNull: false }
  }, {
    tableName: 'leave_requests',
    indexes: [ { fields: ['userId'] }, { fields: ['requestDate'] }, { fields: ['status'] } ]
  });

  LeaveRequest.associate = (models) => {
    LeaveRequest.belongsTo(models.User, { foreignKey: 'userId' });
    LeaveRequest.belongsTo(models.User, { foreignKey: 'approvedBy', as: 'approver' });
  };

  return LeaveRequest;
};
