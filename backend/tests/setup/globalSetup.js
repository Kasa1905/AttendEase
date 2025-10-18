module.exports = async () => {
  console.log('Setting up test environment...');
  
  // Set test environment variables
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.JWT_EXPIRES_IN = '1h';
  
  // Initialize test database using the main sequelize instance
  const { sequelize } = require('../../models');
  await sequelize.sync({ force: true });
  
  console.log('Test environment setup complete');
};