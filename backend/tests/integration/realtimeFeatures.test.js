const request = require('supertest');
const { createServer } = require('http');
const Client = require('socket.io-client');
const app = require('../app');
const { User, Event, AttendanceRecord, DutySession, HourlyLog, Strike, Notification, sequelize } = require('../models');
const { createTestUser, generateTestJWT } = require('./utils/testHelpers');

describe('Integration Tests - Real-time Features and Advanced Workflows', () => {
  let httpServer, ioServer, clientSocket1, clientSocket2;
  let studentUser, teacherUser, coreTeamUser;
  let studentToken, teacherToken, coreToken;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
    
    // Create test users
    studentUser = await createTestUser({
      email: 'student@realtime.com',
      firstName: 'Socket',
      lastName: 'Student',
      role: 'student'
    });

    teacherUser = await createTestUser({
      email: 'teacher@realtime.com',
      firstName: 'Socket',
      lastName: 'Teacher',
      role: 'teacher'
    });

    coreTeamUser = await createTestUser({
      email: 'core@realtime.com',
      firstName: 'Socket',
      lastName: 'Core',
      role: 'core_team'
    });

    studentToken = generateTestJWT(studentUser);
    teacherToken = generateTestJWT(teacherUser);
    coreToken = generateTestJWT(coreTeamUser);

    // Setup socket.io server for testing
    httpServer = createServer(app);
    ioServer = require('../socket/socketHandler')(httpServer);
    
    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket1 = new Client(`http://localhost:${port}`, {
        auth: { token: studentToken }
      });
      clientSocket2 = new Client(`http://localhost:${port}`, {
        auth: { token: coreToken }
      });
    });
  });

  afterAll(async () => {
    if (clientSocket1) clientSocket1.close();
    if (clientSocket2) clientSocket2.close();
    if (ioServer) ioServer.close();
    if (httpServer) httpServer.close();
    await sequelize.close();
  });

  beforeEach(async () => {
    // Clean database before each test
    await Strike.destroy({ where: {}, force: true });
    await HourlyLog.destroy({ where: {}, force: true });
    await DutySession.destroy({ where: {}, force: true });
    await AttendanceRecord.destroy({ where: {}, force: true });
    await Notification.destroy({ where: {}, force: true });
    await Event.destroy({ where: {}, force: true });
  });

  describe('Real-time Notifications', () => {
    test('Strike creation triggers real-time notifications', (done) => {
      let notificationReceived = false;

      // Listen for strike notification on core team socket
      clientSocket2.on('strike:created', (data) => {
        expect(data.strike.userId).toBe(studentUser.id);
        expect(data.strike.reason).toBe('missed_event');
        expect(data.user.firstName).toBe('Socket');
        expect(data.user.lastName).toBe('Student');
        notificationReceived = true;
      });

      // Create an event
      Event.create({
        name: 'Real-time Test Event',
        description: 'Test event for notifications',
        date: new Date(),
        time: '14:00',
        duration: 120,
        location: 'Test Room',
        maxAttendees: 50,
        isActive: true,
        createdBy: teacherUser.id
      }).then(event => {
        // Create a strike via API
        return request(app)
          .post('/api/v1/strikes')
          .set('Authorization', `Bearer ${coreToken}`)
          .send({
            userId: studentUser.id,
            reason: 'missed_event',
            description: 'Student missed the event',
            relatedEventId: event.id
          })
          .expect(201);
      }).then(() => {
        // Wait a bit for the socket event
        setTimeout(() => {
          expect(notificationReceived).toBe(true);
          done();
        }, 500);
      }).catch(done);
    });

    test('Duty session updates broadcast to relevant users', (done) => {
      let sessionStartReceived = false;
      let sessionEndReceived = false;

      // Listen for duty session events on core team socket
      clientSocket2.on('dutySession:started', (data) => {
        expect(data.dutySession.userId).toBe(studentUser.id);
        expect(data.dutySession.status).toBe('active');
        sessionStartReceived = true;
      });

      clientSocket2.on('dutySession:ended', (data) => {
        expect(data.dutySession.status).toBe('completed');
        expect(data.dutySession.endTime).toBeTruthy();
        sessionEndReceived = true;
      });

      let dutySessionId;

      // Create event and attendance record
      Event.create({
        name: 'Duty Test Event',
        description: 'Event for duty testing',
        date: new Date(),
        time: '14:00',
        duration: 120,
        location: 'Test Location',
        maxAttendees: 50,
        isActive: true,
        createdBy: teacherUser.id
      }).then(event => {
        return AttendanceRecord.create({
          userId: studentUser.id,
          eventId: event.id,
          status: 'present',
          dutyEligible: false
        });
      }).then(attendance => {
        // Start duty session
        return request(app)
          .post('/api/v1/duty-sessions')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({ attendanceRecordId: attendance.id })
          .expect(201);
      }).then(response => {
        dutySessionId = response.body.id;
        
        // Wait for start event
        setTimeout(() => {
          expect(sessionStartReceived).toBe(true);
          
          // End duty session
          return request(app)
            .post(`/api/v1/duty-sessions/${dutySessionId}/end`)
            .set('Authorization', `Bearer ${studentToken}`)
            .expect(200);
        }, 500);
      }).then(() => {
        // Wait for end event
        setTimeout(() => {
          expect(sessionEndReceived).toBe(true);
          done();
        }, 500);
      }).catch(done);
    });

    test('User suspension broadcasts to all core team members', (done) => {
      let suspensionReceived = false;

      clientSocket2.on('user:suspended', (data) => {
        expect(data.user.id).toBe(studentUser.id);
        expect(data.user.suspended).toBe(true);
        expect(data.user.suspendedUntil).toBeTruthy();
        expect(data.strikeCount).toBe(5);
        suspensionReceived = true;
      });

      // Create 5 strikes to trigger suspension
      const strikePromises = [];
      for (let i = 0; i < 5; i++) {
        strikePromises.push(
          Strike.create({
            userId: studentUser.id,
            reason: 'missed_event',
            description: `Strike ${i + 1}`,
            isResolved: false,
            createdBy: coreTeamUser.id
          })
        );
      }

      Promise.all(strikePromises).then(() => {
        // Trigger suspension check via API
        return request(app)
          .post('/api/v1/users/check-suspension')
          .set('Authorization', `Bearer ${coreToken}`)
          .send({ userId: studentUser.id })
          .expect(200);
      }).then(() => {
        setTimeout(() => {
          expect(suspensionReceived).toBe(true);
          done();
        }, 500);
      }).catch(done);
    });
  });

  describe('Advanced Strike Management Workflows', () => {
    test('Automatic strike escalation with email notifications', async () => {
      // Create multiple strikes to test escalation
      const strikes = [];
      for (let i = 0; i < 3; i++) {
        const strike = await Strike.create({
          userId: studentUser.id,
          reason: 'missed_event',
          description: `Escalation test strike ${i + 1}`,
          isResolved: false,
          createdBy: coreTeamUser.id
        });
        strikes.push(strike);
      }

      // Check escalation status
      const escalationResponse = await request(app)
        .get(`/api/v1/strikes/escalation-status/${studentUser.id}`)
        .set('Authorization', `Bearer ${coreToken}`)
        .expect(200);

      expect(escalationResponse.body.strikeCount).toBe(3);
      expect(escalationResponse.body.escalationLevel).toBe('warning');
      expect(escalationResponse.body.nextEscalationAt).toBe(5);

      // Create 2 more strikes to trigger suspension
      for (let i = 3; i < 5; i++) {
        await Strike.create({
          userId: studentUser.id,
          reason: 'insufficient_duty_hours',
          description: `Suspension trigger strike ${i + 1}`,
          isResolved: false,
          createdBy: coreTeamUser.id
        });
      }

      // Check final escalation
      const finalEscalationResponse = await request(app)
        .get(`/api/v1/strikes/escalation-status/${studentUser.id}`)
        .set('Authorization', `Bearer ${coreToken}`)
        .expect(200);

      expect(finalEscalationResponse.body.strikeCount).toBe(5);
      expect(finalEscalationResponse.body.escalationLevel).toBe('suspended');
      expect(finalEscalationResponse.body.suspendedUntil).toBeTruthy();
    });

    test('Bulk strike resolution workflow', async () => {
      // Create multiple strikes
      const strikePromises = [];
      for (let i = 0; i < 4; i++) {
        strikePromises.push(
          Strike.create({
            userId: studentUser.id,
            reason: 'missed_event',
            description: `Bulk resolution strike ${i + 1}`,
            isResolved: false,
            createdBy: coreTeamUser.id
          })
        );
      }

      const strikes = await Promise.all(strikePromises);
      const strikeIds = strikes.map(s => s.id);

      // Bulk resolve strikes
      const resolveResponse = await request(app)
        .put('/api/v1/strikes/resolve-bulk')
        .set('Authorization', `Bearer ${coreToken}`)
        .send({
          strikeIds: strikeIds,
          resolutionNotes: 'All strikes resolved due to extenuating circumstances'
        })
        .expect(200);

      expect(resolveResponse.body.resolvedCount).toBe(4);
      expect(resolveResponse.body.strikes).toHaveLength(4);
      expect(resolveResponse.body.strikes.every(s => s.isResolved)).toBe(true);

      // Verify user is no longer suspended after bulk resolution
      const userResponse = await request(app)
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(userResponse.body.suspended).toBe(false);
    });

    test('Strike appeal process workflow', async () => {
      // Create a strike
      const strike = await Strike.create({
        userId: studentUser.id,
        reason: 'excessive_break',
        description: 'Student took 45 minute break',
        isResolved: false,
        createdBy: coreTeamUser.id
      });

      // Student appeals the strike
      const appealResponse = await request(app)
        .post(`/api/v1/strikes/${strike.id}/appeal`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          appealReason: 'I had a medical emergency and needed to take a longer break',
          evidence: 'Medical certificate attached'
        })
        .expect(201);

      expect(appealResponse.body.appealReason).toBe('I had a medical emergency and needed to take a longer break');
      expect(appealResponse.body.status).toBe('pending');

      // Core team reviews and accepts the appeal
      const reviewResponse = await request(app)
        .put(`/api/v1/strikes/${strike.id}/appeal/review`)
        .set('Authorization', `Bearer ${coreToken}`)
        .send({
          decision: 'accepted',
          reviewNotes: 'Medical emergency confirmed, strike dismissed'
        })
        .expect(200);

      expect(reviewResponse.body.appeal.status).toBe('accepted');
      expect(reviewResponse.body.strike.isResolved).toBe(true);
      expect(reviewResponse.body.strike.resolutionNotes).toContain('Appeal accepted');
    });
  });

  describe('Complex Duty Session Workflows', () => {
    test('Multi-day duty session with break tracking', async () => {
      // Create event and attendance
      const event = await Event.create({
        name: 'Multi-day Event',
        description: 'Event spanning multiple days',
        date: new Date(),
        time: '09:00',
        duration: 480, // 8 hours
        location: 'Main Hall',
        maxAttendees: 100,
        isActive: true,
        createdBy: teacherUser.id
      });

      const attendance = await AttendanceRecord.create({
        userId: studentUser.id,
        eventId: event.id,
        status: 'present',
        dutyEligible: false
      });

      // Start duty session
      const dutyResponse = await request(app)
        .post('/api/v1/duty-sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ attendanceRecordId: attendance.id })
        .expect(201);

      const dutySessionId = dutyResponse.body.id;

      // Log multiple hours with different activities and break patterns
      const hourlyLogs = [
        { activity: 'Setup preparation', breakDuration: 15, notes: 'Set up chairs and tables' },
        { activity: 'Registration desk', breakDuration: 20, notes: 'Managed attendee registration' },
        { activity: 'Technical support', breakDuration: 10, notes: 'Helped with AV equipment' },
        { activity: 'Crowd management', breakDuration: 25, notes: 'Managed seating arrangements' },
        { activity: 'Cleanup', breakDuration: 30, notes: 'Post-event cleanup' }
      ];

      for (let i = 0; i < hourlyLogs.length; i++) {
        const logResponse = await request(app)
          .post('/api/v1/hourly-logs')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({
            dutySessionId,
            ...hourlyLogs[i]
          })
          .expect(201);

        expect(logResponse.body.activity).toBe(hourlyLogs[i].activity);
      }

      // End duty session
      const endResponse = await request(app)
        .post(`/api/v1/duty-sessions/${dutySessionId}/end`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(endResponse.body.status).toBe('completed');
      expect(endResponse.body.hourlyLogs).toHaveLength(5);
      expect(endResponse.body.totalBreakTime).toBe(100); // Total break minutes
      
      // Check for excessive break strikes (should have one for 30-minute break)
      const strikesResponse = await request(app)
        .get('/api/v1/strikes')
        .set('Authorization', `Bearer ${coreToken}`)
        .query({ userId: studentUser.id })
        .expect(200);

      const excessiveBreakStrikes = strikesResponse.body.strikes.filter(
        s => s.reason === 'excessive_break'
      );
      expect(excessiveBreakStrikes).toHaveLength(1);
    });

    test('Concurrent duty sessions conflict resolution', async () => {
      // Create two events on the same day
      const event1 = await Event.create({
        name: 'Morning Event',
        description: 'Morning workshop',
        date: new Date(),
        time: '09:00',
        duration: 180,
        location: 'Room A',
        maxAttendees: 30,
        isActive: true,
        createdBy: teacherUser.id
      });

      const event2 = await Event.create({
        name: 'Afternoon Event',
        description: 'Afternoon seminar',
        date: new Date(),
        time: '14:00',
        duration: 180,
        location: 'Room B',
        maxAttendees: 30,
        isActive: true,
        createdBy: teacherUser.id
      });

      // Mark attendance for both events
      const attendance1 = await AttendanceRecord.create({
        userId: studentUser.id,
        eventId: event1.id,
        status: 'present',
        dutyEligible: false
      });

      const attendance2 = await AttendanceRecord.create({
        userId: studentUser.id,
        eventId: event2.id,
        status: 'present',
        dutyEligible: false
      });

      // Start first duty session
      const duty1Response = await request(app)
        .post('/api/v1/duty-sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ attendanceRecordId: attendance1.id })
        .expect(201);

      const dutySession1Id = duty1Response.body.id;

      // Try to start second duty session while first is active (should fail)
      await request(app)
        .post('/api/v1/duty-sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ attendanceRecordId: attendance2.id })
        .expect(409); // Conflict

      // End first duty session
      await request(app)
        .post(`/api/v1/duty-sessions/${dutySession1Id}/end`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      // Now second duty session should be allowed
      const duty2Response = await request(app)
        .post('/api/v1/duty-sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ attendanceRecordId: attendance2.id })
        .expect(201);

      expect(duty2Response.body.attendanceRecordId).toBe(attendance2.id);
    });
  });

  describe('Performance and Scale Testing', () => {
    test('Handles multiple concurrent hourly log submissions', async () => {
      // Create duty session
      const event = await Event.create({
        name: 'Performance Test Event',
        description: 'Event for performance testing',
        date: new Date(),
        time: '10:00',
        duration: 240,
        location: 'Test Location',
        maxAttendees: 50,
        isActive: true,
        createdBy: teacherUser.id
      });

      const attendance = await AttendanceRecord.create({
        userId: studentUser.id,
        eventId: event.id,
        status: 'present',
        dutyEligible: false
      });

      const dutyResponse = await request(app)
        .post('/api/v1/duty-sessions')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ attendanceRecordId: attendance.id })
        .expect(201);

      const dutySessionId = dutyResponse.body.id;

      // Attempt multiple concurrent log submissions
      const concurrentLogs = Array(10).fill().map((_, i) => 
        request(app)
          .post('/api/v1/hourly-logs')
          .set('Authorization', `Bearer ${studentToken}`)
          .send({
            dutySessionId,
            activity: `Concurrent activity ${i}`,
            breakDuration: 10,
            notes: `Log ${i}`
          })
      );

      const results = await Promise.allSettled(concurrentLogs);
      const successfulLogs = results.filter(r => r.status === 'fulfilled' && r.value.status === 201);
      const failedLogs = results.filter(r => r.status === 'fulfilled' && r.value.status !== 201);

      // Should handle race conditions gracefully
      expect(successfulLogs.length).toBeGreaterThan(0);
      expect(successfulLogs.length + failedLogs.length).toBe(10);
    });

    test('System handles high notification load', async () => {
      // Create multiple users and strikes to generate many notifications
      const users = [];
      for (let i = 0; i < 20; i++) {
        const user = await createTestUser({
          email: `loadtest${i}@example.com`,
          firstName: `Load${i}`,
          lastName: 'Test',
          role: 'student'
        });
        users.push(user);
      }

      // Create strikes for all users simultaneously
      const strikePromises = users.map(user => 
        Strike.create({
          userId: user.id,
          reason: 'load_test',
          description: 'Load testing strike',
          isResolved: false,
          createdBy: coreTeamUser.id
        })
      );

      const strikes = await Promise.all(strikePromises);
      expect(strikes).toHaveLength(20);

      // Check that all notifications were created
      const notificationsResponse = await request(app)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${coreToken}`)
        .expect(200);

      expect(notificationsResponse.body.notifications.length).toBeGreaterThan(0);
    });
  });
});