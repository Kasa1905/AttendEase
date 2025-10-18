'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * User Acceptance Testing (UAT) seed file
 * Creates duty sessions for UAT testing
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Get eligible users for duty sessions
    const eligibleUsers = await queryInterface.sequelize.query(
      `SELECT id, firstName, lastName FROM "Users" 
       WHERE email LIKE '%.uat@clubattendance.example' AND dutyEligible = true`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    if (!eligibleUsers.length) {
      console.log('No eligible users found. Make sure to run users.js seeder first.');
      return Promise.resolve();
    }
    
    const dutySessions = [];
    const now = new Date();
    
    // Create past duty sessions (completed)
    for (let i = 1; i <= 8; i++) {
      const sessionDate = new Date(now);
      sessionDate.setDate(now.getDate() - (i * 4)); // Every 4 days in the past
      
      // Pick a random eligible user for each session
      const randomUserIndex = Math.floor(Math.random() * eligibleUsers.length);
      const user = eligibleUsers[randomUserIndex];
      
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
      const randomUserIndex2 = (randomUserIndex + 1) % eligibleUsers.length;
      const user2 = eligibleUsers[randomUserIndex2];
      
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
      const user1 = eligibleUsers[i % eligibleUsers.length];
      const user2 = eligibleUsers[(i + 1) % eligibleUsers.length];
      
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
    
    // Add a few "in progress" sessions for today
    const todayMorningUser = eligibleUsers[0];
    const todayAfternoonUser = eligibleUsers[1];
    
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
    
    return queryInterface.bulkInsert('DutySessions', dutySessions, {});
  },

  down: async (queryInterface, Sequelize) => {
    // Get UAT users
    const users = await queryInterface.sequelize.query(
      `SELECT id FROM "Users" WHERE email LIKE '%.uat@clubattendance.example'`,
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );
    
    const userIds = users.map(user => user.id);
    
    return queryInterface.bulkDelete('DutySessions', {
      userId: {
        [Sequelize.Op.in]: userIds
      }
    }, {});
  }
};