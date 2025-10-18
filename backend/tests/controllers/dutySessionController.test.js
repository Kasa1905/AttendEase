const request = require('supertest');
const app = require('../../app');
const {
  createTestUser,
  generateAuthToken,
  clearDatabase,
  mockDate
} = require('../utils/testHelpers');
const { resetTestDatabase } = require('../setup/database');
const { DutySession, AttendanceRecord, HourlyLog } = require('../../models');

describe('Duty Session Controller', () => {
  beforeEach(async () => {
    await resetTestDatabase();
    await clearDatabase();
  });

  describe('POST /api/v1/duty-sessions/start', () => {
    it('should start a duty session successfully', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      const sessionData = {
        notes: 'Starting duty session'
      };

      const response = await request(app)
        .post('/api/v1/duty-sessions/start')
        .set('Authorization', `Bearer ${token}`)
        .send(sessionData);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.userId).toBe(user.id);
      expect(response.body.data.startedAt).toBeTruthy();
      expect(response.body.data.endedAt).toBe(null);
    });

    it('should prevent starting multiple active sessions', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      // Create an active session
      await DutySession.create({
        userId: user.id,
        startedAt: new Date(),
        endedAt: null
      });

      const response = await request(app)
        .post('/api/v1/duty-sessions/start')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Active duty session already exists/);
    });

    it('should create attendance record for today as on_club_duty', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      const response = await request(app)
        .post('/api/v1/duty-sessions/start')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(200);
      
      // Check that attendance record was created/updated
      const today = new Date().toISOString().slice(0, 10);
      const attendance = await AttendanceRecord.findOne({
        where: { userId: user.id, date: today }
      });
      expect(attendance).toBeTruthy();
      expect(attendance.status).toBe('on_club_duty');
    });
  });

  describe('POST /api/v1/duty-sessions/:id/end', () => {
    it('should end a duty session successfully', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      const session = await DutySession.create({
        userId: user.id,
        startedAt: new Date('2023-01-01T09:00:00Z'),
        endedAt: null
      });

      const response = await request(app)
        .post(`/api/v1/duty-sessions/${session.id}/end`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.endedAt).toBeTruthy();
      expect(response.body.data.totalDurationMinutes).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent session', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      const response = await request(app)
        .post('/api/v1/duty-sessions/999/end')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/Duty session not found/);
    });

    it('should prevent ending already ended session', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      const session = await DutySession.create({
        userId: user.id,
        startedAt: new Date('2023-01-01T09:00:00Z'),
        endedAt: new Date('2023-01-01T11:00:00Z'),
        totalDurationMinutes: 120
      });

      const response = await request(app)
        .post(`/api/v1/duty-sessions/${session.id}/end`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Session already ended/);
    });
  });

  describe('GET /api/v1/duty-sessions', () => {
    it('should get duty sessions for user', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      // Create test sessions
      await DutySession.create({
        userId: user.id,
        startedAt: new Date('2023-01-01T09:00:00Z'),
        endedAt: new Date('2023-01-01T11:00:00Z'),
        totalDurationMinutes: 120
      });

      const response = await request(app)
        .get('/api/v1/duty-sessions')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(1);
    });

    it('should filter sessions by date range', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      await DutySession.create({
        userId: user.id,
        startedAt: new Date('2023-01-01T09:00:00Z'),
        endedAt: new Date('2023-01-01T11:00:00Z'),
        totalDurationMinutes: 120
      });

      await DutySession.create({
        userId: user.id,
        startedAt: new Date('2023-01-15T09:00:00Z'),
        endedAt: new Date('2023-01-15T11:00:00Z'),
        totalDurationMinutes: 120
      });

      const response = await request(app)
        .get('/api/v1/duty-sessions')
        .query({ 
          startDate: '2023-01-01', 
          endDate: '2023-01-10' 
        })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
    });
  });

  describe('GET /api/v1/duty-sessions/:id', () => {
    it('should get specific duty session', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      const session = await DutySession.create({
        userId: user.id,
        startedAt: new Date('2023-01-01T09:00:00Z'),
        endedAt: new Date('2023-01-01T11:00:00Z'),
        totalDurationMinutes: 120,
        notes: 'Test session'
      });

      const response = await request(app)
        .get(`/api/v1/duty-sessions/${session.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(session.id);
      expect(response.body.data.notes).toBe('Test session');
    });

    it('should return 404 for non-existent session', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      const response = await request(app)
        .get('/api/v1/duty-sessions/999')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/v1/duty-sessions/:id/hourly-logs', () => {
    it('should add hourly log to duty session', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      const session = await DutySession.create({
        userId: user.id,
        startedAt: new Date('2023-01-01T09:00:00Z'),
        endedAt: null
      });

      const logData = {
        hour: '2023-01-01T10:00:00Z',
        description: 'Cleaning equipment',
        activityType: 'maintenance'
      };

      const response = await request(app)
        .post(`/api/v1/duty-sessions/${session.id}/hourly-logs`)
        .set('Authorization', `Bearer ${token}`)
        .send(logData);

      expect(response.status).toBe(201);
      expect(response.body.data.description).toBe('Cleaning equipment');
      expect(response.body.data.sessionId).toBe(session.id);
    });

    it('should prevent duplicate hourly logs for same hour', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      const session = await DutySession.create({
        userId: user.id,
        startedAt: new Date('2023-01-01T09:00:00Z'),
        endedAt: null
      });

      // Create first log
      await HourlyLog.create({
        sessionId: session.id,
        hour: new Date('2023-01-01T10:00:00Z'),
        description: 'First log'
      });

      const logData = {
        hour: '2023-01-01T10:00:00Z',
        description: 'Duplicate log',
        activityType: 'maintenance'
      };

      const response = await request(app)
        .post(`/api/v1/duty-sessions/${session.id}/hourly-logs`)
        .set('Authorization', `Bearer ${token}`)
        .send(logData);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/already exists/i);
    });
  });

  describe('GET /api/v1/duty-sessions/active', () => {
    it('should get active duty session for user', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      const activeSession = await DutySession.create({
        userId: user.id,
        startedAt: new Date(),
        endedAt: null
      });

      const response = await request(app)
        .get('/api/v1/duty-sessions/active')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(activeSession.id);
      expect(response.body.data.endedAt).toBe(null);
    });

    it('should return null when no active session', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      const response = await request(app)
        .get('/api/v1/duty-sessions/active')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data).toBe(null);
    });
  });

  describe('POST /api/v1/duty-sessions/:id/break', () => {
    it('should add break time to session', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      const session = await DutySession.create({
        userId: user.id,
        startedAt: new Date('2023-01-01T09:00:00Z'),
        endedAt: null
      });

      const breakData = {
        startTime: '2023-01-01T10:00:00Z',
        endTime: '2023-01-01T10:15:00Z',
        reason: 'Lunch break'
      };

      const response = await request(app)
        .post(`/api/v1/duty-sessions/${session.id}/break`)
        .set('Authorization', `Bearer ${token}`)
        .send(breakData);

      expect(response.status).toBe(201);
      expect(response.body.data.reason).toBe('Lunch break');
      expect(response.body.data.durationMinutes).toBe(15);
    });
  });

  describe('Authorization Tests', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/duty-sessions/start')
        .send({});

      expect(response.status).toBe(401);
    });

    it('should allow students to manage their own sessions', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      const response = await request(app)
        .post('/api/v1/duty-sessions/start')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(200);
    });

    it('should prevent users from accessing other users sessions', async () => {
      const user1 = await createTestUser({ email: 'user1@test.com' });
      const user2 = await createTestUser({ email: 'user2@test.com' });
      const token1 = generateAuthToken(user1.id, 'student');

      const session = await DutySession.create({
        userId: user2.id,
        startedAt: new Date(),
        endedAt: null
      });

      const response = await request(app)
        .get(`/api/v1/duty-sessions/${session.id}`)
        .set('Authorization', `Bearer ${token1}`);

      expect(response.status).toBe(403);
    });
  });

  describe('Duty Validation', () => {
    it('should mark attendance as eligible when minimum hours met', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      const session = await DutySession.create({
        userId: user.id,
        startedAt: new Date('2023-01-01T09:00:00Z'),
        endedAt: new Date('2023-01-01T11:30:00Z'), // 2.5 hours
        totalDurationMinutes: 150
      });

      const response = await request(app)
        .post(`/api/v1/duty-sessions/${session.id}/end`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.dutyEligible).toBe(true);
    });

    it('should mark attendance as ineligible when minimum hours not met', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'student');

      const session = await DutySession.create({
        userId: user.id,
        startedAt: new Date('2023-01-01T09:00:00Z'),
        endedAt: new Date('2023-01-01T10:00:00Z'), // 1 hour
        totalDurationMinutes: 60
      });

      const response = await request(app)
        .post(`/api/v1/duty-sessions/${session.id}/end`)
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.dutyEligible).toBe(false);
    });
  });
});