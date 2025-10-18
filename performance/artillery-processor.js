/**
 * Artillery.io Custom Processor
 * Functions for supporting load testing scenarios
 */
const axios = require('axios');
const fs = require('fs');

// Store session tokens and other state between requests
const globalContext = {
  tokens: {},
  testData: {},
  sockets: {}
};

// Authentication functions
async function authenticateStudent(requestParams, context, ee, next) {
  try {
    const response = await axios.post(context.vars.target + '/api/auth/login', {
      email: context.vars.studentEmail,
      password: context.vars.testPassword
    });

    context.vars.accessToken = response.data.data.tokens.accessToken;
    context.vars.userId = response.data.data.user.id;

    // Also get a current active event for attendance marking
    const eventsResponse = await axios.get(context.vars.target + '/api/events/active', {
      headers: { Authorization: `Bearer ${context.vars.accessToken}` }
    });

    if (eventsResponse.data.data && eventsResponse.data.data.length > 0) {
      context.vars.eventId = eventsResponse.data.data[0].id;
    }

    return next();
  } catch (error) {
    console.error('Student authentication failed:', error.message);
    return next(error);
  }
}

async function authenticateCoreTeam(requestParams, context, ee, next) {
  try {
    const response = await axios.post(context.vars.target + '/api/auth/login', {
      email: context.vars.coreTeamEmail,
      password: context.vars.testPassword
    });

    context.vars.accessToken = response.data.data.tokens.accessToken;
    context.vars.userId = response.data.data.user.id;

    // Get a random user ID for user management tests
    const usersResponse = await axios.get(context.vars.target + '/api/users', {
      headers: { Authorization: `Bearer ${context.vars.accessToken}` }
    });

    if (usersResponse.data.data && usersResponse.data.data.length > 0) {
      const randomIndex = Math.floor(Math.random() * usersResponse.data.data.length);
      context.vars.userId = usersResponse.data.data[randomIndex].id;
    }

    return next();
  } catch (error) {
    console.error('Core team authentication failed:', error.message);
    return next(error);
  }
}

// Socket.io connection helpers
function connectSocket(requestParams, context, ee, next) {
  // This would use a socket.io client in a real implementation
  // For Artillery, we're simulating the connection
  console.log(`[Socket.io] Simulating connection for user ${context.vars.userId}`);
  
  // Store connection info in context
  context.vars.socketConnected = true;
  context.vars.socketId = `socket_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  // In a real implementation, we'd connect with socket.io-client
  // const io = require('socket.io-client');
  // const socket = io(`${context.vars.target}`, {
  //   extraHeaders: { Authorization: `Bearer ${context.vars.accessToken}` }
  // });
  // globalContext.sockets[context.vars.socketId] = socket;

  return next();
}

function emitSocketEvent(requestParams, context, ee, next) {
  if (!context.vars.socketConnected) {
    console.error('[Socket.io] No active socket connection');
    return next(new Error('No active socket connection'));
  }

  console.log(`[Socket.io] Emitting event for user ${context.vars.userId}`);
  
  // In a real implementation, we'd emit an event
  // const socket = globalContext.sockets[context.vars.socketId];
  // socket.emit('user:status', { status: 'online', userId: context.vars.userId });
  
  return next();
}

function disconnectSocket(requestParams, context, ee, next) {
  if (!context.vars.socketConnected) {
    return next();
  }

  console.log(`[Socket.io] Disconnecting socket for user ${context.vars.userId}`);
  
  // In a real implementation, we'd disconnect
  // const socket = globalContext.sockets[context.vars.socketId];
  // socket.disconnect();
  // delete globalContext.sockets[context.vars.socketId];
  
  context.vars.socketConnected = false;
  return next();
}

// Test data setup and cleanup
function setupTestData(requestParams, context, ee, next) {
  console.log('Setting up test data for load testing');
  
  // In a real implementation, this might create test users, events, etc.
  // via API calls or direct database interaction
  
  return next();
}

function cleanupTestData(requestParams, context, ee, next) {
  console.log('Cleaning up test data after load testing');
  
  // In a real implementation, this might clean up created test data
  
  return next();
}

module.exports = {
  authenticateStudent,
  authenticateCoreTeam,
  connectSocket,
  emitSocketEvent,
  disconnectSocket,
  setupTestData,
  cleanupTestData
};