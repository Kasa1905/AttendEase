const request = require('supertest');
const app = require('../app');
const { User, Event, AttendanceRecord, DutySession, HourlyLog, Strike, sequelize } = require('../models');
const { createTestUser, generateTestJWT } = require('./utils/testHelpers');

describe('Integration Tests - User Authentication Flow', () => {
  beforeAll(async () => {
    // Ensure clean database state
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean all tables before each test
    await Strike.destroy({ where: {}, force: true });
    await HourlyLog.destroy({ where: {}, force: true });
    await DutySession.destroy({ where: {}, force: true });
    await AttendanceRecord.destroy({ where: {}, force: true });
    await Event.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });
  });

  describe('Complete Authentication Flow', () => {
    test('User registration, login, and access protected routes', async () => {
      // Step 1: Register new user
      const registerResponse = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'password123',
          firstName: 'New',
          lastName: 'User',
          role: 'student',
          rollNumber: 'TEST001'
        })
        .expect(201);

      expect(registerResponse.body).toHaveProperty('user');
      expect(registerResponse.body).toHaveProperty('tokens');
      expect(registerResponse.body.user.email).toBe('newuser@test.com');
      expect(registerResponse.body.user.firstName).toBe('New');
      expect(registerResponse.body.user.lastName).toBe('User');

      const { accessToken, refreshToken } = registerResponse.body.tokens;
      expect(accessToken).toBeTruthy();
      expect(refreshToken).toBeTruthy();

      // Step 2: Use access token to access protected route
      const profileResponse = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(profileResponse.body.email).toBe('newuser@test.com');

      // Step 3: Login with same credentials
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'newuser@test.com',
          password: 'password123'
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('user');
      expect(loginResponse.body).toHaveProperty('tokens');
      expect(loginResponse.body.user.email).toBe('newuser@test.com');

      // Step 4: Use new token from login
      const newAccessToken = loginResponse.body.tokens.accessToken;
      const newProfileResponse = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      expect(newProfileResponse.body.email).toBe('newuser@test.com');
    });

    test('Token refresh flow when access token expires', async () => {
      // Create user and get initial tokens
      const user = await createTestUser({
        email: 'refresh@test.com',
        firstName: 'Refresh',
        lastName: 'Test',
        role: 'student'
      });

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'refresh@test.com',
          password: 'password123'
        })
        .expect(200);

      const { refreshToken } = loginResponse.body.tokens;

      // Use refresh token to get new access token
      const refreshResponse = await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(refreshResponse.body).toHaveProperty('accessToken');
      expect(refreshResponse.body).toHaveProperty('refreshToken');

      // Use new access token
      const newAccessToken = refreshResponse.body.accessToken;
      const profileResponse = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${newAccessToken}`)
        .expect(200);

      expect(profileResponse.body.email).toBe('refresh@test.com');
    });

    test('Logout invalidates tokens', async () => {
      const user = await createTestUser({
        email: 'logout@test.com',
        role: 'student'
      });

      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'logout@test.com',
          password: 'password123'
        })
        .expect(200);

      const { accessToken } = loginResponse.body.tokens;

      // Access protected route with valid token
      await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Logout
      await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Try to access protected route with invalidated token
      await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);
    });
  });

  describe('Complete Attendance Workflow', () => {
    let student, teacher, coreTeam, event;

    beforeEach(async () => {
      // Create test users
      student = await createTestUser({
        email: 'student@test.com',
        firstName: 'Test',
        lastName: 'Student',
        role: 'student',
        rollNumber: 'ST001'
      });

      teacher = await createTestUser({
        email: 'teacher@test.com',
        firstName: 'Test',
        lastName: 'Teacher',
        role: 'teacher'
      });

      coreTeam = await createTestUser({
        email: 'core@test.com',
        firstName: 'Core',
        lastName: 'Member',
        role: 'core_team'
      });

      // Create test event
      event = await Event.create({
        name: 'Weekly Meeting',
        description: 'Regular weekly meeting',
        date: new Date(),
        time: '14:00',
        duration: 120,
        location: 'Conference Room',
        maxAttendees: 50,
        isActive: true,
        createdBy: teacher.id
      });
    });

    test('Complete attendance flow - student marks attendance and performs duty', async () => {
      const studentToken = generateTestJWT(student);
      const coreToken = generateTestJWT(coreTeam);

      // Step 1: Student marks attendance for event
      const attendanceResponse = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          eventId: event.id,
          status: 'present'
        })
        .expect(201);

      expect(attendanceResponse.body.eventId).toBe(event.id);
      expect(attendanceResponse.body.userId).toBe(student.id);
      expect(attendanceResponse.body.status).toBe('present');

      // Step 2: Student starts duty session
      const dutyStartResponse = await request(app)
        .post('/api/v1/duty-sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          attendanceRecordId: attendanceResponse.body.id
        })
        .expect(201);

      const dutySessionId = dutyStartResponse.body.id;
      expect(dutyStartResponse.body.attendanceRecordId).toBe(attendanceResponse.body.id);
      expect(dutyStartResponse.body.userId).toBe(student.id);
      expect(dutyStartResponse.body.status).toBe('active');

      // Step 3: Student logs hourly activities
      const hourlyLog1 = await request(app)
        .post('/api/v1/hourly-logs')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          dutySessionId,
          activity: 'Cleaning classroom A',
          breakDuration: 10,
          notes: 'Completed cleaning tasks'
        })
        .expect(201);

      expect(hourlyLog1.body.dutySessionId).toBe(dutySessionId);
      expect(hourlyLog1.body.activity).toBe('Cleaning classroom A');

      // Step 4: Student logs second hour (after sufficient time)
      const hourlyLog2 = await request(app)
        .post('/api/v1/hourly-logs')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          dutySessionId,
          activity: 'Organizing materials',
          breakDuration: 15,
          notes: 'Organized storage room'
        })
        .expect(201);

      expect(hourlyLog2.body.dutySessionId).toBe(dutySessionId);

      // Step 5: Student ends duty session
      const dutyEndResponse = await request(app)
        .post(`/api/v1/duty-sessions/${dutySessionId}/end`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(dutyEndResponse.body.status).toBe('completed');
      expect(dutyEndResponse.body.endTime).toBeTruthy();

      // Step 6: Core team can view the completed duty session
      const dutySessionResponse = await request(app)
        .get(`/api/v1/duty-sessions/${dutySessionId}`)
        .set('Authorization', `Bearer ${coreToken}`)
        .expect(200);

      expect(dutySessionResponse.body.id).toBe(dutySessionId);
      expect(dutySessionResponse.body.status).toBe('completed');
      expect(dutySessionResponse.body.hourlyLogs).toHaveLength(2);

      // Step 7: Verify attendance record is updated
      const updatedAttendanceResponse = await request(app)
        .get(`/api/v1/attendance/${attendanceResponse.body.id}`)
        .set('Authorization', `Bearer ${coreToken}`)
        .expect(200);

      expect(updatedAttendanceResponse.body.dutyEligible).toBe(true);
    });

    test('Strike creation workflow when duty requirements not met', async () => {
      const studentToken = generateTestJWT(student);
      const coreToken = generateTestJWT(coreTeam);

      // Step 1: Student marks attendance
      const attendanceResponse = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          eventId: event.id,
          status: 'present'
        })
        .expect(201);

      // Step 2: Student starts duty session
      const dutyStartResponse = await request(app)
        .post('/api/v1/duty-sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          attendanceRecordId: attendanceResponse.body.id
        })
        .expect(201);

      const dutySessionId = dutyStartResponse.body.id;

      // Step 3: Student logs only one hour (insufficient duty)
      await request(app)
        .post('/api/v1/hourly-logs')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          dutySessionId,
          activity: 'Brief cleaning',
          breakDuration: 5,
          notes: 'Only did minimal work'
        })
        .expect(201);

      // Step 4: End duty session prematurely
      const dutyEndResponse = await request(app)
        .post(`/api/v1/duty-sessions/${dutySessionId}/end`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(dutyEndResponse.body.status).toBe('completed');

      // Step 5: Check if strike was created for insufficient duty
      const strikesResponse = await request(app)
        .get('/api/v1/strikes')
        .set('Authorization', `Bearer ${coreToken}`)
        .query({ userId: student.id })
        .expect(200);

      expect(strikesResponse.body.strikes).toHaveLength(1);
      expect(strikesResponse.body.strikes[0].reason).toBe('insufficient_duty_hours');
      expect(strikesResponse.body.strikes[0].userId).toBe(student.id);

      // Step 6: Core team resolves the strike
      const strikeId = strikesResponse.body.strikes[0].id;
      const resolveResponse = await request(app)
        .put(`/api/v1/strikes/${strikeId}/resolve`)
        .set('Authorization', `Bearer ${coreToken}`)
        .send({
          resolutionNotes: 'Student was sick, excused'
        })
        .expect(200);

      expect(resolveResponse.body.isResolved).toBe(true);
      expect(resolveResponse.body.resolutionNotes).toBe('Student was sick, excused');
    });

    test('User suspension workflow after multiple strikes', async () => {
      const studentToken = generateTestJWT(student);
      const coreToken = generateTestJWT(coreTeam);

      // Create multiple strikes to trigger suspension
      for (let i = 0; i < 5; i++) {
        await Strike.create({
          userId: student.id,
          reason: 'missed_event',
          description: `Missed event ${i + 1}`,
          isResolved: false,
          createdBy: coreTeam.id
        });
      }

      // Step 1: Check user status after strikes
      const userResponse = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(userResponse.body.suspended).toBe(true);
      expect(userResponse.body.suspendedUntil).toBeTruthy();

      // Step 2: Suspended user should not be able to mark attendance
      const attendanceResponse = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          eventId: event.id,
          status: 'present'
        })
        .expect(403);

      expect(attendanceResponse.body.error).toContain('suspended');

      // Step 3: Core team can view user's strikes
      const strikesResponse = await request(app)
        .get('/api/v1/strikes')
        .set('Authorization', `Bearer ${coreToken}`)
        .query({ userId: student.id })
        .expect(200);

      expect(strikesResponse.body.strikes).toHaveLength(5);
      expect(strikesResponse.body.strikes.every(strike => !strike.isResolved)).toBe(true);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('Handles concurrent duty session creation attempts', async () => {
      const student = await createTestUser({
        email: 'concurrent@test.com',
        role: 'student'
      });

      const event = await Event.create({
        name: 'Test Event',
        description: 'Test event',
        date: new Date(),
        time: '14:00',
        duration: 120,
        location: 'Test Location',
        maxAttendees: 50,
        isActive: true,
        createdBy: 1
      });

      const attendanceRecord = await AttendanceRecord.create({
        userId: student.id,
        eventId: event.id,
        status: 'present',
        dutyEligible: false
      });

      const studentToken = generateTestJWT(student);

      // Try to create multiple duty sessions simultaneously
      const promises = Array(3).fill().map(() => 
        request(app)
          .post('/api/v1/duty-sessions')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ attendanceRecordId: attendanceRecord.id })
      );

      const responses = await Promise.allSettled(promises);
      
      // Only one should succeed
      const successCount = responses.filter(r => r.status === 'fulfilled' && r.value.status === 201).length;
      const failCount = responses.filter(r => r.status === 'fulfilled' && r.value.status !== 201).length;

      expect(successCount).toBe(1);
      expect(failCount).toBe(2);
    });

    test('Handles invalid data gracefully', async () => {
      const student = await createTestUser({ role: 'student' });
      const studentToken = generateTestJWT(student);

      // Test invalid event attendance
      await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          eventId: 99999, // Non-existent event
          status: 'present'
        })
        .expect(404);

      // Test invalid duty session creation
      await request(app)
        .post('/api/v1/duty-sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          attendanceRecordId: 99999 // Non-existent attendance record
        })
        .expect(404);

      // Test invalid hourly log creation
      await request(app)
        .post('/api/v1/hourly-logs')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          dutySessionId: 99999, // Non-existent duty session
          activity: 'Test activity'
        })
        .expect(404);
    });

    test('Data persistence across server restarts', async () => {
      const student = await createTestUser({
        email: 'persist@test.com',
        role: 'student'
      });

      const event = await Event.create({
        name: 'Persistence Test Event',
        description: 'Test event for persistence',
        date: new Date(),
        time: '14:00',
        duration: 120,
        location: 'Test Location',
        maxAttendees: 50,
        isActive: true,
        createdBy: student.id
      });

      const studentToken = generateTestJWT(student);

      // Create attendance record
      const attendanceResponse = await request(app)
        .post('/api/v1/attendance')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          eventId: event.id,
          status: 'present'
        })
        .expect(201);

      const attendanceId = attendanceResponse.body.id;

      // Simulate server restart by creating new connection
      await sequelize.close();
      await sequelize.authenticate();

      // Verify data persists
      const persistedAttendance = await AttendanceRecord.findByPk(attendanceId);
      expect(persistedAttendance).toBeTruthy();
      expect(persistedAttendance.status).toBe('present');

      const persistedEvent = await Event.findByPk(event.id);
      expect(persistedEvent).toBeTruthy();
      expect(persistedEvent.name).toBe('Persistence Test Event');

      const persistedUser = await User.findByPk(student.id);
      expect(persistedUser).toBeTruthy();
      expect(persistedUser.email).toBe('persist@test.com');
    });
  });
});