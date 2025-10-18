const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { User } = require('../../models');

// Authentication helpers
const createTestUser = async (userData = {}) => {
  const defaultUser = {
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    password: await bcrypt.hash('password123', 10),
    role: 'student',
    department: 'Computer Science',
    year: 2,
    isActive: true
  };
  
  return User.create({ ...defaultUser, ...userData });
};

const generateAuthToken = (userId, role = 'student') => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );
};

const createAuthenticatedRequest = (agent, token) => {
  return agent.set('Authorization', `Bearer ${token}`);
};

// Mock data factories
const mockUser = (overrides = {}) => ({
  id: 1,
  firstName: 'Test',
  lastName: 'User',
  email: 'test@example.com',
  role: 'student',
  department: 'Computer Science',
  year: 2,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

const mockAttendanceRecord = (overrides = {}) => ({
  id: 1,
  userId: 1,
  eventId: 1,
  status: 'present_in_class',
  isApproved: false,
  dutyEligible: true,
  markedAt: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

const mockDutySession = (overrides = {}) => ({
  id: 1,
  userId: 1,
  startTime: new Date(),
  endTime: null,
  totalDuration: 0,
  notes: '',
  event: 'Test Event',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

const mockHourlyLog = (overrides = {}) => ({
  id: 1,
  dutySessionId: 1,
  loggedAt: new Date(),
  workDescription: 'Test work description',
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

const mockNotification = (overrides = {}) => ({
  id: 1,
  userId: 1,
  title: 'Test Notification',
  message: 'This is a test notification',
  type: 'info',
  isRead: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

const mockStrike = (overrides = {}) => ({
  id: 1,
  userId: 1,
  reason: 'Insufficient duty hours',
  date: new Date(),
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides
});

// API response helpers
const expectSuccessResponse = (response, expectedStatus = 200, expectedData = null) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('data');
  if (expectedData) {
    expect(response.body.data).toMatchObject(expectedData);
  }
};

const expectErrorResponse = (response, expectedStatus, expectedMessage = null) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('error');
  if (expectedMessage) {
    expect(response.body.error).toMatch(expectedMessage);
  }
};

const expectValidationError = (response, expectedStatus = 400, field = null) => {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('error');
  if (field) {
    expect(response.body.error).toMatch(field);
  }
};

// Database helpers
const clearDatabase = async () => {
  const models = require('../../models');
  const modelNames = Object.keys(models).filter(name => name !== 'sequelize' && name !== 'Sequelize');
  
  for (const modelName of modelNames) {
    await models[modelName].destroy({ where: {}, truncate: true });
  }
};

const createTestData = async () => {
  const { seedTestData } = require('../setup/database');
  return await seedTestData();
};

// Date and time helpers
const mockDate = (dateString) => {
  const mockDate = new Date(dateString);
  jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
  return mockDate;
};

const addHours = (date, hours) => {
  const newDate = new Date(date);
  newDate.setHours(newDate.getHours() + hours);
  return newDate;
};

const addDays = (date, days) => {
  const newDate = new Date(date);
  newDate.setDate(newDate.getDate() + days);
  return newDate;
};

// File upload helpers
const createMockFile = (filename = 'test.csv', mimetype = 'text/csv', content = 'name,email\nTest User,test@example.com') => {
  return {
    originalname: filename,
    mimetype: mimetype,
    buffer: Buffer.from(content),
    size: Buffer.byteLength(content)
  };
};

// Socket.io testing helpers
const createMockSocket = () => {
  return {
    emit: jest.fn(),
    on: jest.fn(),
    join: jest.fn(),
    leave: jest.fn(),
    id: 'mock-socket-id'
  };
};

const createMockIo = () => {
  return {
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    sockets: {
      sockets: new Map()
    }
  };
};

module.exports = {
  // Auth helpers
  createTestUser,
  generateAuthToken,
  createAuthenticatedRequest,
  
  // Mock data factories
  mockUser,
  mockAttendanceRecord,
  mockDutySession,
  mockHourlyLog,
  mockNotification,
  mockStrike,
  
  // API response helpers
  expectSuccessResponse,
  expectErrorResponse,
  expectValidationError,
  
  // Database helpers
  clearDatabase,
  createTestData,
  
  // Date helpers
  mockDate,
  addHours,
  addDays,
  
  // File helpers
  createMockFile,
  
  // Socket helpers
  createMockSocket,
  createMockIo
};