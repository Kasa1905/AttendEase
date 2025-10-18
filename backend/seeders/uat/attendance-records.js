'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * User Acceptance Testing (UAT) seed file
 * Creates attendance records for the UAT test users and events
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Get users and past events for attendance records
    const users = await queryInterface.sequelize.query(
      `SELECT id, role, firstName, lastName FROM "Users" WHERE email LIKE '%.uat@clubattendance.example'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    const pastEvents = await queryInterface.sequelize.query(
      `SELECT id, title, startTime, endTime FROM "Events" WHERE title LIKE 'Past Test Event%'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    if (!users.length || !pastEvents.length) {
      console.log('Missing users or events. Make sure to run users.js and events.js seeders first.');
      return Promise.resolve();
    }
    
    const attendanceRecords = [];
    const now = new Date();
    
    // Create attendance records for past events
    pastEvents.forEach(event => {
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
    
    return queryInterface.bulkInsert('AttendanceRecords', attendanceRecords, {});
  },

  down: async (queryInterface, Sequelize) => {
    // Get UAT users
    const users = await queryInterface.sequelize.query(
      `SELECT id FROM "Users" WHERE email LIKE '%.uat@clubattendance.example'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    const userIds = users.map(user => user.id);
    
    return queryInterface.bulkDelete('AttendanceRecords', {
      userId: {
        [Sequelize.Op.in]: userIds
      }
    }, {});
  }
};