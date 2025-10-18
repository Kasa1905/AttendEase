const { sequelize } = require('../../models');

// Initialize test database
async function setupTestDatabase() {
  try {
    await sequelize.authenticate();
    
    // Sync all models to create tables
    await sequelize.sync({ force: true });
    
    console.log('Test database initialized successfully');
    return sequelize;
  } catch (error) {
    console.error('Unable to initialize test database:', error);
    throw error;
  }
}

// Clean up test database
async function teardownTestDatabase() {
  try {
    await sequelize.close();
    console.log('Test database closed successfully');
  } catch (error) {
    console.error('Error closing test database:', error);
    throw error;
  }
}

// Reset database between tests
async function resetTestDatabase() {
  try {
    await sequelize.sync({ force: true });
  } catch (error) {
    console.error('Error resetting test database:', error);
    throw error;
  }
}
    console.error('Error resetting test database:', error);
    throw error;
  }
// Seed test data
async function seedTestData() {
  const { User, Event, AttendanceRecord, DutySession } = require('../../models');
  const bcrypt = require('bcryptjs');
  
  try {
    // Create test users
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const testStudent = await User.create({
      id: 1,
      firstName: 'Test',
      lastName: 'Student',
      email: 'student@test.com',
      password: hashedPassword,
      role: 'Student',
      year: 2,
      branch: 'Computer Science',
      rollNumber: 'CS21001',
      isActive: true,
      dutyEligible: true
    });
    
    const testCoreTeam = await User.create({
      id: 2,
      firstName: 'Test',
      lastName: 'Core',
      email: 'core@test.com',
      password: hashedPassword,
      role: 'Student',
      year: 3,
      branch: 'Computer Science',
      rollNumber: 'CS20001',
      isActive: true,
      dutyEligible: true
    });
    
    const testTeacher = await User.create({
      id: 3,
      firstName: 'Test',
      lastName: 'Teacher',
      email: 'teacher@test.com',
      password: hashedPassword,
      role: 'Teacher',
      isActive: true,
      dutyEligible: false
    });
    
    // Create test events
    const testEvent = await Event.create({
      id: 1,
      name: 'Test Event',
      date: new Date(),
      time: '14:00',
      location: 'Test Room',
      description: 'Test event for automated testing',
      type: 'Meeting',
      isActive: true,
      createdBy: 3
    });
    
    console.log('Test data seeded successfully');
    return { testStudent, testCoreTeam, testTeacher, testEvent };
  } catch (error) {
    console.error('Error seeding test data:', error);
    throw error;
  }
}

module.exports = {
  setupTestDatabase,
  teardownTestDatabase,
  resetTestDatabase,
  seedTestData
};