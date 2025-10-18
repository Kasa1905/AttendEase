const { Server } = require('socket.io');
const jwtUtils = require('../utils/jwt');

let io;

function initSocket(server, opts = {}) {
  const origin = process.env.NODE_ENV === 'production' ? process.env.SOCKET_IO_CORS_ORIGIN : (process.env.SOCKET_IO_CORS_ORIGIN || '*');
  if (process.env.NODE_ENV === 'production' && !origin) throw new Error('SOCKET_IO_CORS_ORIGIN must be set in production');
  io = new Server(server, { cors: { origin, methods: ['GET','POST'] }, ...opts });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth && socket.handshake.auth.token;
      if (!token) return next(new Error('Authentication error'));
      const payload = await jwtUtils.verifyToken(token);
      socket.user = payload;
      return next();
    } catch (e) { return next(new Error('Authentication error')); }
  });

  io.on('connection', (socket) => {
    try {
      const user = socket.user;
      // join personal room
      socket.join(`user:${user.id}`);
      // join role-based room if role exists
      if (user.role) socket.join(`role:${user.role}`);
      socket.emit('connected', { ok: true });

      // Import room management
      socket.on('join-import-room', ({ batchId }) => {
        if (batchId) socket.join(batchId);
      });
      socket.on('leave-import-room', ({ batchId }) => {
        if (batchId) socket.leave(batchId);
      });

      socket.on('disconnect', () => { /* cleanup if needed */ });
    } catch (e) { /* ignore */ }
  });

  return io;
}

function getIo() { return io; }

function emitToUser(userId, event, payload) {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}

function emitToRole(role, event, payload) {
  if (!io) return;
  io.to(`role:${role}`).emit(event, payload);
}

module.exports = { initSocket, getIo, emitToUser, emitToRole };
