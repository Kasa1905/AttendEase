const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const env = process.env.NODE_ENV || 'development';

let sequelize;

if (env === 'test') {
  sequelize = new Sequelize({ 
    dialect: 'sqlite', 
    storage: ':memory:', 
    logging: false 
  });
} else {
  const useSSL = (process.env.DB_SSL === 'true') || env === 'production';

  const common = {
    dialect: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    logging: env === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  };

  if (useSSL) {
    common.dialectOptions = {
      ssl: {
        require: true,
        // For many managed DBs you may need to set rejectUnauthorized to false
        rejectUnauthorized: false
      }
    };
  }

  const database = process.env.DB_NAME || 'club_attendance_dev';
  const username = process.env.DB_USER || 'postgres';
  const password = process.env.DB_PASSWORD || 'postgres';

  sequelize = new Sequelize(database, username, password, common);
}

module.exports = { sequelize };
