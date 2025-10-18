require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const env = process.env.NODE_ENV || 'development';
const useSSL = process.env.DB_SSL === 'true' || env === 'production';

const common = {
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'club_attendance_dev',
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 5432,
  dialect: 'postgres',
  logging: env === 'development' ? console.log : false,
  pool: { max: 10, min: 0, acquire: 30000, idle: 10000 }
};

if (useSSL) {
  common.dialectOptions = { ssl: { require: true, rejectUnauthorized: false } };
}

module.exports = {
  development: common,
  test: Object.assign({}, common, { database: process.env.DB_NAME_TEST || 'club_attendance_test' }),
  production: Object.assign({}, common, { logging: false })
};
