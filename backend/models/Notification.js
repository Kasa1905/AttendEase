module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    type: {
      type: DataTypes.ENUM('hourly_reminder','request_approved','request_rejected','duty_session_reminder','strike_warning','generic'),
      allowNull: false,
    },
    title: { type: DataTypes.STRING, allowNull: false },
    message: { type: DataTypes.TEXT, allowNull: false },
    data: { type: DataTypes.JSONB, allowNull: true },
    isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
    readAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'Notifications',
  });

  Notification.associate = (models) => {
    Notification.belongsTo(models.User, { as: 'user', foreignKey: 'userId' });
  };

  Notification.prototype.markRead = async function() {
    this.isRead = true; this.readAt = new Date(); return this.save();
  };

  return Notification;
};
