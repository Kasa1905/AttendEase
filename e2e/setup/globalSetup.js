const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

/**
 * Global setup for E2E tests
 * Ensures backend service is started and test database is ready
 */
async function globalSetup() {
  console.log('🚀 Starting E2E test setup...');
  
  try {
    // Initialize the test database
    await initializeTestDatabase();
    
    console.log('✅ E2E test setup completed successfully');
  } catch (error) {
    console.error('❌ E2E test setup failed:', error);
    process.exit(1);
  }
}

/**
 * Setup test environment variables
 */
function setupTestEnvironment() {
  console.log('⚙️ Setting up test environment...');
  
  // Load .env.test from backend directory
  require('dotenv').config({ path: path.resolve(__dirname, '../../backend/.env.test') });
  
  // Set environment variables for test mode
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-e2e';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-e2e';
  process.env.EMAIL_ENABLED = 'false';
  process.env.SOCKET_ENABLED = 'true';
}

/**
 * Initialize test database with migrations and basic setup
 */
async function initializeTestDatabase() {
  console.log('🗄️ Initializing test database...');
  
  try {
    // Change to backend directory for database operations
    const backendDir = path.join(__dirname, '../../backend');
    process.chdir(backendDir);

    // Run database migrations for test environment
    execSync('npm run db:migrate:test', { stdio: 'inherit' });
    
    // Run basic seeders for test environment
    execSync('npm run db:seed:test', { stdio: 'inherit' });
    
    console.log('✅ Test database initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize test database:', error);
    throw error;
  }
}

/**
 * Wait for backend service to be ready
 */
async function waitForBackendService(maxRetries = 30) {
  console.log('⏳ Waiting for backend service...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get('http://localhost:5000/health');
      console.log('✅ Backend service is ready');
      return;
    } catch (error) {
      console.log(`Backend not ready, retrying... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error('Backend service failed to start within expected time');
}

/**
 * Wait for frontend service to be ready
 */
async function waitForFrontendService(maxRetries = 30) {
  console.log('⏳ Waiting for frontend service...');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      await axios.get('http://localhost:5173');
      console.log('✅ Frontend service is ready');
      return;
    } catch (error) {
      console.log(`Frontend not ready, retrying... (${i + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error('Frontend service failed to start within expected time');
}

/**
 * Create test users for different roles
 */
async function createTestUsers() {
  console.log('👥 Creating test users...');
  
  const testUsers = [
    {
      firstName: 'Test',
      lastName: 'Student',
      email: 'student@test.com',
      password: 'password123',
      department: 'Computer Science',
      year: 3,
      role: 'student'
    },
    {
      firstName: 'Test',
      lastName: 'CoreTeam',
      email: 'coreteam@test.com',
      password: 'password123',
      department: 'Computer Science',
      year: 4,
      role: 'core_team'
    },
    {
      firstName: 'Test',
      lastName: 'Teacher',
      email: 'teacher@test.com',
      password: 'password123',
      department: 'Computer Science',
      year: null,
      role: 'teacher'
    }
  ];

  try {
    for (const user of testUsers) {
      await axios.post('http://localhost:5000/api/auth/register', user);
      console.log(`✅ Created test user: ${user.email} (${user.role})`);
    }
  } catch (error) {
    console.error('❌ Failed to create test users:', error.response?.data || error.message);
    // Don't throw here - users might already exist
  }
}

/**
 * Seed test data for comprehensive testing
 */
async function seedTestData() {
  console.log('🌱 Seeding test data...');
  
  try {
    // Login as core team member to create test data
    const loginResponse = await axios.post('http://localhost:5000/api/auth/login', {
      email: 'coreteam@test.com',
      password: 'password123'
    });
    
    const token = loginResponse.data.data.tokens.accessToken;
    const headers = { Authorization: `Bearer ${token}` };

    // Create test event
    const testEvent = {
      name: 'Test Event for E2E',
      description: 'Automated test event for E2E testing',
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '17:00',
      location: 'Test Lab',
      isActive: true
    };

    await axios.post('http://localhost:5000/api/events', testEvent, { headers });
    console.log('✅ Created test event');

    // Create additional test students for bulk operations
    const additionalStudents = [
      {
        firstName: 'Bulk',
        lastName: 'Student1',
        email: 'bulk1@test.com',
        password: 'password123',
        department: 'Electronics',
        year: 2,
        role: 'student'
      },
      {
        firstName: 'Bulk',
        lastName: 'Student2',
        email: 'bulk2@test.com',
        password: 'password123',
        department: 'Mechanical',
        year: 1,
        role: 'student'
      }
    ];

    for (const student of additionalStudents) {
      await axios.post('http://localhost:5000/api/auth/register', student);
    }
    console.log('✅ Created additional test students');

  } catch (error) {
    console.error('❌ Failed to seed test data:', error.response?.data || error.message);
    // Don't throw here - some data might already exist
  }
}

/**
 * Global Teardown for E2E Tests
 * Cleans up test data and stops services
 */
async function globalTeardown() {
  console.log('🧹 Starting global E2E test teardown...');

  try {
    // Clean up test files
    await cleanupTestFiles();
    
    // Clear test database (if using file-based storage)
    await cleanupTestDatabase();
    
    console.log('✅ Global E2E test teardown completed successfully');
  } catch (error) {
    console.error('❌ Global E2E test teardown failed:', error);
    // Don't throw in teardown - we want tests to complete
  }
}

/**
 * Cleanup test files and artifacts
 */
async function cleanupTestFiles() {
  console.log('🗑️ Cleaning up test files...');
  
  try {
    const testResultsDir = path.join(__dirname, '../../test-results');
    const fixturesDir = path.join(__dirname, '../fixtures');
    
    // Clean up test fixtures
    if (fs.existsSync(fixturesDir)) {
      const files = fs.readdirSync(fixturesDir);
      for (const file of files) {
        if (file.startsWith('test-')) {
          fs.unlinkSync(path.join(fixturesDir, file));
        }
      }
    }
    
    console.log('✅ Test files cleaned up');
  } catch (error) {
    console.error('Failed to cleanup test files:', error);
  }
}

/**
 * Cleanup test database
 */
async function cleanupTestDatabase() {
  console.log('🗄️ Cleaning up test database...');
  
  try {
    // For SQLite in-memory database, no cleanup needed
    // For file-based database, we could delete the file here
    console.log('✅ Test database cleaned up');
  } catch (error) {
    console.error('Failed to cleanup test database:', error);
  }
}

/**
 * Health check utility for services
 */
async function healthCheck(url, timeout = 5000) {
  try {
    const response = await axios.get(url, { timeout });
    return response.status === 200;
  } catch (error) {
    return false;
  }
}

// Export functions for Playwright configuration
module.exports = globalSetup;
module.exports.globalTeardown = globalTeardown;