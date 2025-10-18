module.exports = (sequelize, DataTypes) => {
  const Event = sequelize.define('Event', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT },
    eventDate: { type: DataTypes.DATEONLY, allowNull: false },
    startTime: { type: DataTypes.TIME },
    endTime: { type: DataTypes.TIME },
    location: { type: DataTypes.STRING },
    eventType: { type: DataTypes.ENUM('meeting', 'workshop', 'competition', 'social', 'other') },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    createdBy: { type: DataTypes.UUID, allowNull: false },
    maxParticipants: { type: DataTypes.INTEGER }
  }, {
    tableName: 'events',
    indexes: [ { fields: ['eventDate'] }, { fields: ['eventType'] } ]
  });

  Event.associate = (models) => {
    Event.belongsTo(models.User, { foreignKey: 'createdBy', as: 'creator' });
    Event.hasMany(models.DutySession, { foreignKey: 'eventId' });
  };

  return Event;
};
