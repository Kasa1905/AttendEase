const request = require('supertest');
const app = require('../../app');
const {
  createTestUser,
  generateAuthToken,
  clearDatabase,
  mockDate
} = require('../utils/testHelpers');
const { resetTestDatabase } = require('../setup/database');
const { AttendanceRecord, DutySession } = require('../../models');

describe('Attendance Controller', () => {
  beforeEach(async () => {
    await resetTestDatabase();
    await clearDatabase();
  });

  describe('POST /api/v1/attendance', () => {
    it('should mark attendance successfully', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'teacher');

      const attendanceData = {
        userId: user.id,
        date: '2023-01-01',
        status: 'present_in_class',
        notes: 'Present in class'
      };

      const response = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${token}`)
        .send(attendanceData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data.userId).toBe(user.id);
      expect(response.body.data.status).toBe('present_in_class');
      expect(response.body.data.date).toBe('2023-01-01T00:00:00.000Z');
    });

    it('should auto-create duty session for on_club_duty status', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'teacher');
      const today = new Date().toISOString().slice(0, 10);

      const attendanceData = {
        userId: user.id,
        date: today,
        status: 'on_club_duty'
      };

      const response = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${token}`)
        .send(attendanceData);

      expect(response.status).toBe(201);
      
      // Check that duty session was created
      const dutySession = await DutySession.findOne({ 
        where: { userId: user.id, endedAt: null } 
      });
      expect(dutySession).toBeTruthy();
    });

    it('should reject future-dated duty attendance', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'teacher');
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const attendanceData = {
        userId: user.id,
        date: futureDate.toISOString().slice(0, 10),
        status: 'on_club_duty'
      };

      const response = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${token}`)
        .send(attendanceData);

      expect(response.status).toBe(400);
      expect(response.body.error).toMatch(/Cannot auto-create duty session for future-dated attendance/);
    });

    it('should validate required fields', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'teacher');

      const response = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should validate status values', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'teacher');

      const attendanceData = {
        userId: user.id,
        date: '2023-01-01',
        status: 'invalid_status'
      };

      const response = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${token}`)
        .send(attendanceData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/attendance', () => {
    it('should get attendance records', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'teacher');
      
      // Create test attendance record
      await AttendanceRecord.create({
        userId: user.id,
        date: '2023-01-01',
        status: 'present_in_class'
      });

      const response = await request(app)
        .get('/api/v1/attendance')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(1);
    });

    it('should filter attendance by date range', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'teacher');
      
      // Create multiple attendance records
      await AttendanceRecord.create({
        userId: user.id,
        date: '2023-01-01',
        status: 'present_in_class'
      });
      await AttendanceRecord.create({
        userId: user.id,
        date: '2023-01-15',
        status: 'absent'
      });

      const response = await request(app)
        .get('/api/v1/attendance')
        .query({ 
          startDate: '2023-01-01', 
          endDate: '2023-01-10' 
        })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].date).toBe('2023-01-01T00:00:00.000Z');
    });

    it('should filter attendance by user', async () => {
      const user1 = await createTestUser({ email: 'user1@test.com' });
      const user2 = await createTestUser({ email: 'user2@test.com' });
      const token = generateAuthToken(user1.id, 'teacher');
      
      await AttendanceRecord.create({
        userId: user1.id,
        date: '2023-01-01',
        status: 'present_in_class'
      });
      await AttendanceRecord.create({
        userId: user2.id,
        date: '2023-01-01',
        status: 'absent'
      });

      const response = await request(app)
        .get('/api/v1/attendance')
        .query({ userId: user1.id })
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].userId).toBe(user1.id);
    });
  });

  describe('PUT /api/v1/attendance/:id', () => {
    it('should update attendance record', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'teacher');
      
      const attendance = await AttendanceRecord.create({
        userId: user.id,
        date: '2023-01-01',
        status: 'present_in_class'
      });

      const updateData = {
        status: 'absent',
        notes: 'Updated to absent'
      };

      const response = await request(app)
        .put(`/api/v1/attendance/${attendance.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('absent');
      expect(response.body.data.notes).toBe('Updated to absent');
    });

    it('should return 404 for non-existent attendance', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'teacher');

      const response = await request(app)
        .put('/api/v1/attendance/999')
        .set('Authorization', `Bearer ${token}`)
        .send({ status: 'absent' });

      expect(response.status).toBe(404);
      expect(response.body.error).toMatch(/not found/i);
    });
  });

  describe('POST /api/v1/attendance/bulk', () => {
    it('should mark bulk attendance', async () => {
      const user1 = await createTestUser({ email: 'user1@test.com' });
      const user2 = await createTestUser({ email: 'user2@test.com' });
      const token = generateAuthToken(user1.id, 'teacher');

      const bulkData = {
        date: '2023-01-01',
        attendanceRecords: [
          { userId: user1.id, status: 'present_in_class' },
          { userId: user2.id, status: 'absent' }
        ]
      };

      const response = await request(app)
        .post('/api/v1/attendance/bulk')
        .set('Authorization', `Bearer ${token}`)
        .send(bulkData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
    });
  });

  describe('POST /api/v1/attendance/validate-duty', () => {
    it('should validate duty attendance eligibility', async () => {
      const user = await createTestUser();
      const token = generateAuthToken(user.id, 'teacher');

      // Create a duty session
      const dutySession = await DutySession.create({
        userId: user.id,
        startedAt: new Date('2023-01-01T09:00:00Z'),
        endedAt: new Date('2023-01-01T11:30:00Z'),
        totalDurationMinutes: 150
      });

      const response = await request(app)
        .post('/api/v1/attendance/validate-duty')
        .set('Authorization', `Bearer ${token}`)
        .send({
          userId: user.id,
          date: '2023-01-01'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('eligible');
    });
  });

  describe('Authorization Tests', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/v1/attendance')
        .send({
          userId: '123',
          date: '2023-01-01',
          status: 'present_in_class'
        });

      expect(response.status).toBe(401);
    });

    it('should require teacher or admin role for marking attendance', async () => {
      const user = await createTestUser();
      const studentToken = generateAuthToken(user.id, 'student');

      const response = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          userId: user.id,
          date: '2023-01-01',
          status: 'present_in_class'
        });

      expect(response.status).toBe(403);
    });
  });
});