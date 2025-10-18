'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * User Acceptance Testing (UAT) seed file for attendance data
 * Creates events, attendance records, duty sessions, and more for UAT testing
 * File: 002-uat-attendance-data.js (runs after 001-uat-users.js)
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Get UAT users for creating related records
    const users = await queryInterface.sequelize.query(
      `SELECT id, firstName, lastName, role, dutyEligible FROM "Users" WHERE email LIKE '%.uat@clubattendance.example'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    if (!users.length) {
      console.log('No UAT users found. Make sure to run 001-uat-users.js first.');
      return Promise.resolve();
    }

    // Create utility function to get user by first name
    const getUserByFirstName = (firstName) => {
      return users.find(user => user.firstName === firstName);
    };
    
    // Create utility function to get duty eligible users
    const getDutyEligibleUsers = () => {
      return users.filter(user => user.dutyEligible === true);
    };
    
    // --------------------------
    // 1. Create Events
    // --------------------------
    const now = new Date();
    const pastEvents = [];
    const futureEvents = [];
    
    // Past events (within the last month)
    for (let i = 1; i <= 10; i++) {
      const eventDate = new Date(now);
      eventDate.setDate(now.getDate() - (i * 3)); // Every 3 days in the past
      
      pastEvents.push({
        id: uuidv4(),
        title: `UAT Past Event #${i}`,
        description: `This is a past test event #${i} for UAT testing`,
        location: i % 2 === 0 ? 'Main Hall' : 'Conference Room B',
        startTime: new Date(eventDate.setHours(18, 0, 0, 0)),
        endTime: new Date(eventDate.setHours(20, 0, 0, 0)),
        isRecurring: false,
        recurringPattern: null,
        isRequired: i % 3 === 0, // Every third event is required
        eventType: i % 4 === 0 ? 'Workshop' : (i % 4 === 1 ? 'Meeting' : (i % 4 === 2 ? 'Social' : 'Other')),
        createdAt: new Date(eventDate.setHours(eventDate.getHours() - 72)), // Created 3 days before event
        updatedAt: new Date(eventDate.setHours(eventDate.getHours() + 24)) // Updated 1 day before event
      });
    }
    
    // Upcoming events (within the next month)
    for (let i = 1; i <= 10; i++) {
      const eventDate = new Date(now);
      eventDate.setDate(now.getDate() + (i * 3)); // Every 3 days in the future
      
      futureEvents.push({
        id: uuidv4(),
        title: `UAT Upcoming Event #${i}`,
        description: `This is an upcoming test event #${i} for UAT testing`,
        location: i % 2 === 0 ? 'Main Auditorium' : 'Meeting Room A',
        startTime: new Date(eventDate.setHours(18, 0, 0, 0)),
        endTime: new Date(eventDate.setHours(20, 0, 0, 0)),
        isRecurring: i === 10, // Only the last event is recurring
        recurringPattern: i === 10 ? 'FREQ=WEEKLY;COUNT=4;BYDAY=TU' : null, // Weekly on Tuesday, 4 occurrences
        isRequired: i % 3 === 0, // Every third event is required
        eventType: i % 4 === 0 ? 'Workshop' : (i % 4 === 1 ? 'Meeting' : (i % 4 === 2 ? 'Social' : 'Other')),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    // Special events
    const specialEvents = [
      {
        id: uuidv4(),
        title: 'UAT All-Day Conference',
        description: 'A full-day conference event for testing all-day event handling',
        location: 'Convention Center',
        startTime: (() => {
          const date = new Date(now);
          date.setDate(now.getDate() + 15);
          return new Date(date.setHours(9, 0, 0, 0));
        })(),
        endTime: (() => {
          const date = new Date(now);
          date.setDate(now.getDate() + 15);
          return new Date(date.setHours(17, 0, 0, 0));
        })(),
        isRecurring: false,
        recurringPattern: null,
        isRequired: true,
        eventType: 'Conference',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        title: 'UAT Emergency Meeting',
        description: 'Last-minute emergency meeting for testing notifications',
        location: 'Main Hall',
        startTime: (() => {
          const date = new Date(now);
          date.setHours(now.getHours() + 4);
          return date;
        })(),
        endTime: (() => {
          const date = new Date(now);
          date.setHours(now.getHours() + 5);
          return date;
        })(),
        isRecurring: false,
        recurringPattern: null,
        isRequired: true,
        eventType: 'Emergency',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: uuidv4(),
        title: 'UAT Monthly Planning',
        description: 'Monthly recurring planning session for testing recurring events',
        location: 'Conference Room A',
        startTime: (() => {
          const date = new Date(now);
          date.setDate(1); // First day of current month
          return new Date(date.setHours(15, 0, 0, 0));
        })(),
        endTime: (() => {
          const date = new Date(now);
          date.setDate(1); // First day of current month
          return new Date(date.setHours(17, 0, 0, 0));
        })(),
        isRecurring: true,
        recurringPattern: 'FREQ=MONTHLY;COUNT=12;BYMONTHDAY=1', // Monthly on the 1st, 12 occurrences
        isRequired: true,
        eventType: 'Planning',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    // Combine all events
    const allEvents = [...pastEvents, ...futureEvents, ...specialEvents];
    
    // Insert events
    await queryInterface.bulkInsert('Events', allEvents, {});
    
    // --------------------------
    // 2. Create Attendance Records
    // --------------------------
    const attendanceRecords = [];
    
    // Get inserted past events
    const insertedPastEvents = await queryInterface.sequelize.query(
      `SELECT id, title, startTime, endTime FROM "Events" WHERE title LIKE 'UAT Past Event%'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    // Create attendance records for past events
    insertedPastEvents.forEach(event => {
      // Different attendance patterns for different users
      users.forEach(user => {
        // Skip creating attendance for some combinations to simulate realistic attendance patterns
        if (Math.random() > 0.8) return;
        
        // Determine attendance status based on user role and patterns
        let status = 'present';
        let arrivalTime = new Date(event.startTime);
        let departureTime = new Date(event.endTime);
        
        // Inactive member is always absent
        if (user.firstName === 'Inactive') {
          status = 'absent';
          arrivalTime = null;
          departureTime = null;
        } 
        // Irregular member has more absences and late arrivals
        else if (user.firstName === 'Irregular') {
          const rand = Math.random();
          if (rand < 0.5) {
            status = 'absent';
            arrivalTime = null;
            departureTime = null;
          } else if (rand < 0.8) {
            status = 'late';
            // Late by 15-30 minutes
            arrivalTime = new Date(arrivalTime.getTime() + (15 + Math.floor(Math.random() * 15)) * 60000);
          }
        }
        // Regular member sometimes late
        else if (user.firstName === 'Regular') {
          const rand = Math.random();
          if (rand < 0.2) {
            status = 'absent';
            arrivalTime = null;
            departureTime = null;
          } else if (rand < 0.3) {
            status = 'late';
            // Late by 5-15 minutes
            arrivalTime = new Date(arrivalTime.getTime() + (5 + Math.floor(Math.random() * 10)) * 60000);
          }
        }
        // Active member rarely misses events
        else if (user.firstName === 'Active') {
          if (Math.random() < 0.1) {
            status = 'excused';
            arrivalTime = null;
            departureTime = null;
          }
        }
        
        // Create the attendance record
        attendanceRecords.push({
          id: uuidv4(),
          userId: user.id,
          eventId: event.id,
          status: status,
          arrivalTime: arrivalTime,
          departureTime: departureTime,
          notes: status === 'excused' ? 'Prior notification of absence given' : null,
          dutyEligible: user.role !== 'GUEST' && status === 'present',
          createdAt: now,
          updatedAt: now
        });
      });
    });
    
    // Insert attendance records
    await queryInterface.bulkInsert('AttendanceRecords', attendanceRecords, {});
    
    // --------------------------
    // 3. Create Duty Sessions
    // --------------------------
    const dutySessions = [];
    const dutyEligibleUsers = getDutyEligibleUsers();
    
    if (dutyEligibleUsers.length === 0) {
      console.log('No duty eligible users found.');
    } else {
      // Create past duty sessions (completed)
      for (let i = 1; i <= 8; i++) {
        const sessionDate = new Date(now);
        sessionDate.setDate(now.getDate() - (i * 4)); // Every 4 days in the past
        
        // Pick a random eligible user for each session
        const randomUserIndex = Math.floor(Math.random() * dutyEligibleUsers.length);
        const user = dutyEligibleUsers[randomUserIndex];
        
        // Create morning session
        dutySessions.push({
          id: uuidv4(),
          userId: user.id,
          date: sessionDate,
          startTime: new Date(new Date(sessionDate).setHours(9, 0, 0, 0)),
          endTime: new Date(new Date(sessionDate).setHours(12, 0, 0, 0)),
          status: 'completed',
          notes: i % 3 === 0 ? 'Regular morning duty session' : null,
          createdAt: new Date(new Date(sessionDate).setDate(sessionDate.getDate() - 7)), // Created a week before
          updatedAt: new Date(new Date(sessionDate).setHours(12, 5, 0, 0)) // Updated right after completion
        });
        
        // Create afternoon session with a different user
        const randomUserIndex2 = (randomUserIndex + 1) % dutyEligibleUsers.length;
        const user2 = dutyEligibleUsers[randomUserIndex2];
        
        dutySessions.push({
          id: uuidv4(),
          userId: user2.id,
          date: sessionDate,
          startTime: new Date(new Date(sessionDate).setHours(13, 0, 0, 0)),
          endTime: new Date(new Date(sessionDate).setHours(16, 0, 0, 0)),
          status: i === 1 ? 'missed' : 'completed', // One missed session for testing
          notes: i === 1 ? 'Failed to show up for duty' : 'Regular afternoon duty session',
          createdAt: new Date(new Date(sessionDate).setDate(sessionDate.getDate() - 7)), // Created a week before
          updatedAt: new Date(new Date(sessionDate).setHours(16, 5, 0, 0)) // Updated right after completion
        });
      }
      
      // Create upcoming duty sessions (scheduled)
      for (let i = 1; i <= 8; i++) {
        const sessionDate = new Date(now);
        sessionDate.setDate(now.getDate() + (i * 4)); // Every 4 days in the future
        
        // Pick users in rotation
        const user1 = dutyEligibleUsers[i % dutyEligibleUsers.length];
        const user2 = dutyEligibleUsers[(i + 1) % dutyEligibleUsers.length];
        
        // Morning session
        dutySessions.push({
          id: uuidv4(),
          userId: user1.id,
          date: sessionDate,
          startTime: new Date(new Date(sessionDate).setHours(9, 0, 0, 0)),
          endTime: new Date(new Date(sessionDate).setHours(12, 0, 0, 0)),
          status: 'scheduled',
          notes: null,
          createdAt: now,
          updatedAt: now
        });
        
        // Afternoon session
        dutySessions.push({
          id: uuidv4(),
          userId: user2.id,
          date: sessionDate,
          startTime: new Date(new Date(sessionDate).setHours(13, 0, 0, 0)),
          endTime: new Date(new Date(sessionDate).setHours(16, 0, 0, 0)),
          status: 'scheduled',
          notes: null,
          createdAt: now,
          updatedAt: now
        });
      }
      
      // Add today's sessions
      const todayMorningUser = dutyEligibleUsers[0];
      const todayAfternoonUser = dutyEligibleUsers[1];
      
      // Morning session (completed if current time is past noon)
      const morningStatus = now.getHours() >= 12 ? 'completed' : 'in-progress';
      dutySessions.push({
        id: uuidv4(),
        userId: todayMorningUser.id,
        date: new Date(now.setHours(0, 0, 0, 0)),
        startTime: new Date(new Date(now).setHours(9, 0, 0, 0)),
        endTime: new Date(new Date(now).setHours(12, 0, 0, 0)),
        status: morningStatus,
        notes: 'Today\'s morning duty session',
        createdAt: new Date(new Date(now).setDate(now.getDate() - 7)),
        updatedAt: morningStatus === 'completed' ? new Date(new Date(now).setHours(12, 5, 0, 0)) : now
      });
      
      // Afternoon session (in progress if current time is between 1 PM and 4 PM)
      const afternoonStatus = now.getHours() >= 16 ? 'completed' : 
                             (now.getHours() >= 13 ? 'in-progress' : 'scheduled');
      dutySessions.push({
        id: uuidv4(),
        userId: todayAfternoonUser.id,
        date: new Date(now.setHours(0, 0, 0, 0)),
        startTime: new Date(new Date(now).setHours(13, 0, 0, 0)),
        endTime: new Date(new Date(now).setHours(16, 0, 0, 0)),
        status: afternoonStatus,
        notes: 'Today\'s afternoon duty session',
        createdAt: new Date(new Date(now).setDate(now.getDate() - 7)),
        updatedAt: afternoonStatus === 'completed' ? new Date(new Date(now).setHours(16, 5, 0, 0)) : now
      });
      
      // Insert duty sessions
      await queryInterface.bulkInsert('DutySessions', dutySessions, {});
    }

    // --------------------------
    // 4. Create Leave Requests
    // --------------------------
    const leaveRequests = [];
    
    // Add some leave requests for testing
    // Admin approved leave request for Active Member (past)
    const activeMember = getUserByFirstName('Active');
    const admin = getUserByFirstName('Admin');
    const manager = getUserByFirstName('Manager');
    
    if (activeMember && admin) {
      const pastStartDate = new Date(now);
      pastStartDate.setDate(now.getDate() - 14);
      
      const pastEndDate = new Date(pastStartDate);
      pastEndDate.setDate(pastStartDate.getDate() + 2);
      
      leaveRequests.push({
        id: uuidv4(),
        userId: activeMember.id,
        startDate: pastStartDate,
        endDate: pastEndDate,
        reason: 'Family emergency',
        status: 'approved',
        reviewerId: admin.id,
        reviewDate: new Date(pastStartDate.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days before
        reviewNotes: 'Approved due to family emergency',
        createdAt: new Date(pastStartDate.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days before
        updatedAt: new Date(pastStartDate.getTime() - 2 * 24 * 60 * 60 * 1000) // 2 days before
      });
    }
    
    // Manager rejected leave request for Regular Member (past)
    const regularMember = getUserByFirstName('Regular');
    if (regularMember && manager) {
      const pastStartDate = new Date(now);
      pastStartDate.setDate(now.getDate() - 10);
      
      const pastEndDate = new Date(pastStartDate);
      pastEndDate.setDate(pastStartDate.getDate() + 5);
      
      leaveRequests.push({
        id: uuidv4(),
        userId: regularMember.id,
        startDate: pastStartDate,
        endDate: pastEndDate,
        reason: 'Vacation',
        status: 'rejected',
        reviewerId: manager.id,
        reviewDate: new Date(pastStartDate.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day before
        reviewNotes: 'Rejected due to upcoming important events',
        createdAt: new Date(pastStartDate.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days before
        updatedAt: new Date(pastStartDate.getTime() - 1 * 24 * 60 * 60 * 1000) // 1 day before
      });
    }
    
    // Pending leave request for Irregular Member (future)
    const irregularMember = getUserByFirstName('Irregular');
    if (irregularMember) {
      const futureStartDate = new Date(now);
      futureStartDate.setDate(now.getDate() + 10);
      
      const futureEndDate = new Date(futureStartDate);
      futureEndDate.setDate(futureStartDate.getDate() + 3);
      
      leaveRequests.push({
        id: uuidv4(),
        userId: irregularMember.id,
        startDate: futureStartDate,
        endDate: futureEndDate,
        reason: 'Medical appointment',
        status: 'pending',
        reviewerId: null,
        reviewDate: null,
        reviewNotes: null,
        createdAt: new Date(futureStartDate.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        updatedAt: new Date(futureStartDate.getTime() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
      });
    }
    
    // Insert leave requests if any
    if (leaveRequests.length > 0) {
      await queryInterface.bulkInsert('LeaveRequests', leaveRequests, {});
    }

    // --------------------------
    // 5. Create Strikes
    // --------------------------
    const strikes = [];
    
    // Add a strike for the Irregular Member (missed event)
    if (irregularMember && admin) {
      const missedEvent = insertedPastEvents[0]; // First past event
      
      strikes.push({
        id: uuidv4(),
        userId: irregularMember.id,
        issuerId: admin.id,
        reason: 'Missed required event without notice',
        date: new Date(missedEvent.startTime),
        relatedEventId: missedEvent.id,
        severity: 'medium',
        notes: 'First offense',
        createdAt: new Date(new Date(missedEvent.endTime).getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day after
        updatedAt: new Date(new Date(missedEvent.endTime).getTime() + 1 * 24 * 60 * 60 * 1000) // 1 day after
      });
    }
    
    // Add a strike for the Suspended Member (missed duty)
    const suspendedMember = getUserByFirstName('Suspended');
    if (suspendedMember && manager) {
      strikes.push({
        id: uuidv4(),
        userId: suspendedMember.id,
        issuerId: manager.id,
        reason: 'Missed assigned duty session',
        date: new Date(new Date(now).setDate(now.getDate() - 15)),
        relatedEventId: null,
        severity: 'high',
        notes: 'Second offense, resulting in temporary suspension',
        createdAt: new Date(new Date(now).setDate(now.getDate() - 14)),
        updatedAt: new Date(new Date(now).setDate(now.getDate() - 14))
      });
    }
    
    // Insert strikes if any
    if (strikes.length > 0) {
      await queryInterface.bulkInsert('Strikes', strikes, {});
    }
    
    // --------------------------
    // 6. Create Notifications
    // --------------------------
    const notifications = [];
    
    // Add notifications for different users
    users.forEach(user => {
      // Skip for guest users
      if (user.firstName === 'Guest') return;
      
      // New event notification for everyone
      notifications.push({
        id: uuidv4(),
        userId: user.id,
        type: 'event',
        title: 'New Event Added',
        message: 'A new required event has been added to the calendar',
        isRead: Math.random() > 0.5, // Some read, some unread
        data: JSON.stringify({
          eventId: futureEvents[0].id,
          eventTitle: futureEvents[0].title
        }),
        createdAt: new Date(new Date(now).setDate(now.getDate() - 2)),
        updatedAt: new Date(new Date(now).setDate(now.getDate() - 2))
      });
      
      // Duty reminder for duty eligible users with upcoming sessions
      if (user.dutyEligible) {
        notifications.push({
          id: uuidv4(),
          userId: user.id,
          type: 'duty',
          title: 'Upcoming Duty Session',
          message: 'You have a duty session scheduled in the next week',
          isRead: Math.random() > 0.7, // Some read, some unread
          data: JSON.stringify({
            date: new Date(new Date(now).setDate(now.getDate() + 4))
          }),
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      
      // Strike notification for irregular and suspended members
      if (user.firstName === 'Irregular' || user.firstName === 'Suspended') {
        notifications.push({
          id: uuidv4(),
          userId: user.id,
          type: 'strike',
          title: 'Strike Issued',
          message: user.firstName === 'Suspended' ? 
            'You have received a high-severity strike resulting in suspension' : 
            'You have received a strike for missing a required event',
          isRead: false, // All unread
          data: JSON.stringify({
            severity: user.firstName === 'Suspended' ? 'high' : 'medium',
            date: new Date(new Date(now).setDate(now.getDate() - 14))
          }),
          createdAt: new Date(new Date(now).setDate(now.getDate() - 14)),
          updatedAt: new Date(new Date(now).setDate(now.getDate() - 14))
        });
      }
    });
    
    // Insert notifications if any
    if (notifications.length > 0) {
      await queryInterface.bulkInsert('Notifications', notifications, {});
    }
    
    console.log('UAT attendance data seeding completed successfully!');
    return Promise.resolve();
  },

  down: async (queryInterface, Sequelize) => {
    // Get UAT users
    const users = await queryInterface.sequelize.query(
      `SELECT id FROM "Users" WHERE email LIKE '%.uat@clubattendance.example'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    const userIds = users.map(user => user.id);
    
    // Delete all related records for UAT users
    await queryInterface.bulkDelete('Notifications', {
      userId: {
        [Sequelize.Op.in]: userIds
      }
    }, {});
    
    await queryInterface.bulkDelete('Strikes', {
      userId: {
        [Sequelize.Op.in]: userIds
      }
    }, {});
    
    await queryInterface.bulkDelete('LeaveRequests', {
      userId: {
        [Sequelize.Op.in]: userIds
      }
    }, {});
    
    await queryInterface.bulkDelete('DutySessions', {
      userId: {
        [Sequelize.Op.in]: userIds
      }
    }, {});
    
    await queryInterface.bulkDelete('AttendanceRecords', {
      userId: {
        [Sequelize.Op.in]: userIds
      }
    }, {});
    
    // Delete UAT events
    await queryInterface.bulkDelete('Events', {
      title: {
        [Sequelize.Op.like]: 'UAT%'
      }
    }, {});
    
    console.log('UAT attendance data cleanup completed successfully!');
    return Promise.resolve();
  }
};