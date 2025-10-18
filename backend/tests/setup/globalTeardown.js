const { teardownTestDatabase } = require('./database');

module.exports = async () => {
  console.log('Tearing down test environment...');
  
  // Clean up test database
  await teardownTestDatabase();
  
  console.log('Test environment teardown complete');
};