const bcrypt = require('bcryptjs');
require('dotenv').config();
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS, 10) || 10;

module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: { type: DataTypes.STRING, unique: true, allowNull: false, validate: { isEmail: true } },
    password: { type: DataTypes.STRING, allowNull: false },
    firstName: { type: DataTypes.STRING, allowNull: false },
    lastName: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM('student', 'core_team', 'teacher'), defaultValue: 'student' },
    studentId: { type: DataTypes.STRING, unique: true, allowNull: true },
    department: { type: DataTypes.STRING },
    year: { type: DataTypes.INTEGER },
    section: { type: DataTypes.STRING },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    lastLogin: { type: DataTypes.DATE },
    suspendedUntil: { type: DataTypes.DATE, allowNull: true, comment: 'Date until which the user is suspended' },
    strikeCount: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false, comment: 'Current active strike count for the user' }
  }, {
    tableName: 'users',
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password')) {
          const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    }
  });

  User.prototype.comparePassword = async function (candidate) {
    return bcrypt.compare(candidate, this.password);
  };

  User.prototype.isSuspended = function () {
    if (!this.suspendedUntil) return false;
    return new Date() < new Date(this.suspendedUntil);
  };

  User.prototype.incrementStrikeCount = function () {
    this.strikeCount = (this.strikeCount || 0) + 1;
    return this.save();
  };

  User.prototype.resetStrikeCount = function () {
    this.strikeCount = 0;
    return this.save();
  };

  User.findSuspendedUsers = function () {
    return this.findAll({
      where: {
        suspendedUntil: {
          [sequelize.Op.gt]: new Date()
        }
      }
    });
  };

  User.associate = (models) => {
    User.hasMany(models.AttendanceRecord, { foreignKey: 'userId' });
    User.hasMany(models.DutySession, { foreignKey: 'userId' });
    User.hasMany(models.Strike, { foreignKey: 'userId' });
    User.hasMany(models.Event, { foreignKey: 'createdBy' });
  };

  return User;
};
