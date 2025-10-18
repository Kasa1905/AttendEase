module.exports = (sequelize, DataTypes) => {
  const Strike = sequelize.define('Strike', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    reason: { type: DataTypes.ENUM('missed_hourly_log', 'insufficient_duty_hours', 'excessive_break', 'other') },
    description: { type: DataTypes.TEXT },
    date: { type: DataTypes.DATEONLY, allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    strikeCountAtTime: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    resolutionNotes: { type: DataTypes.TEXT },
    resolvedBy: { type: DataTypes.UUID, allowNull: true },
    resolvedAt: { type: DataTypes.DATE, allowNull: true },
    severity: { type: DataTypes.ENUM('warning', 'minor', 'major'), defaultValue: 'minor' }
  }, {
    tableName: 'strikes',
    indexes: [ { fields: ['userId'] }, { fields: ['date'] }, { fields: ['isActive'] } ]
  });

  Strike.associate = (models) => {
    Strike.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    Strike.belongsTo(models.User, { foreignKey: 'resolvedBy', as: 'resolver' });
  };

  Strike.countActiveForUser = async function (userId) {
    return await Strike.count({ where: { userId, isActive: true } });
  };

  return Strike;
};
