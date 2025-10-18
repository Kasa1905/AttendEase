'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * User Acceptance Testing (UAT) seed file
 * Creates a set of test events for UAT environment
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create date variables for different types of events
    const now = new Date();
    
    // Past events (within the last month)
    const pastEvents = [];
    for (let i = 1; i <= 10; i++) {
      const eventDate = new Date(now);
      eventDate.setDate(now.getDate() - (i * 3)); // Every 3 days in the past
      
      pastEvents.push({
        id: uuidv4(),
        title: `Past Test Event #${i}`,
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
    const upcomingEvents = [];
    for (let i = 1; i <= 10; i++) {
      const eventDate = new Date(now);
      eventDate.setDate(now.getDate() + (i * 3)); // Every 3 days in the future
      
      upcomingEvents.push({
        id: uuidv4(),
        title: `Upcoming Test Event #${i}`,
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

    // Special events with specific test scenarios
    const specialEvents = [
      {
        id: uuidv4(),
        title: 'All-Day Conference',
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
        title: 'Emergency Meeting',
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
        title: 'Monthly Planning Session',
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
    const allEvents = [...pastEvents, ...upcomingEvents, ...specialEvents];
    
    return queryInterface.bulkInsert('Events', allEvents, {});
  },

  down: async (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('Events', {
      title: {
        [Sequelize.Op.like]: '%Test Event%'
      }
    }, {});
  }
};