const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { getCollection } = require('../config/db');
const { eventBus } = require('./eventService');

const ROOM_PATTERN = /^[a-zA-Z0-9_-]{1,40}$/;

function getToken(socket) {
  const authToken = socket.handshake.auth && socket.handshake.auth.token;
  const authorization = socket.handshake.headers.authorization;
  if (typeof authToken === 'string') {
    return authToken.startsWith('Bearer ') ? authToken.slice(7).trim() : authToken.trim();
  }
  if (typeof authorization === 'string' && authorization.startsWith('Bearer ')) {
    return authorization.slice(7).trim();
  }
  return null;
}

function emitError(socket, message) {
  socket.emit('errorMessage', { message });
}

function initializeSocketService(io, config, logger = console) {
  io.use(async (socket, next) => {
    const token = getToken(socket);
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret);
      if (
        typeof payload !== 'object' ||
        typeof payload.sub !== 'string' ||
        !ObjectId.isValid(payload.sub) ||
        !['user', 'admin'].includes(payload.role)
      ) {
        return next(new Error('Invalid authentication token'));
      }

      const user = await getCollection('users').findOne(
        { _id: new ObjectId(payload.sub) },
        { projection: { username: 1, role: 1 } }
      );
      if (!user) {
        return next(new Error('Authenticated user no longer exists'));
      }
      socket.data.user = { id: user._id.toString(), username: user.username, role: user.role };
      return next();
    } catch (error) {
      return next(new Error(error.name === 'TokenExpiredError'
        ? 'Authentication token has expired'
        : 'Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    logger.log(`User connected: ${socket.id}`);
    eventBus.emit('userConnected', user);

    socket.join('general');
    socket.emit('roomJoined', { room: 'general' });
    socket.to('general').emit('userJoined', { username: user.username, room: 'general' });

    socket.on('joinRoom', (input) => {
      const room = input && typeof input.room === 'string' ? input.room.trim() : 'general';
      if (!ROOM_PATTERN.test(room)) {
        return emitError(socket, 'Room must be 1-40 letters, numbers, underscores, or hyphens');
      }
      if (socket.rooms.has(room)) {
        return socket.emit('roomJoined', { room });
      }

      socket.join(room);
      logger.log(`${socket.id} joined room ${room}`);
      socket.emit('roomJoined', { room });
      socket.to(room).emit('userJoined', { username: user.username, room });
    });

    socket.on('chatMessage', (input) => {
      const room = input && typeof input.room === 'string' ? input.room.trim() : '';
      const message = input && typeof input.message === 'string' ? input.message.trim() : '';
      if (!ROOM_PATTERN.test(room) || !socket.rooms.has(room)) {
        return emitError(socket, 'Join a valid room before sending a message');
      }
      if (!message || message.length > 2000) {
        return emitError(socket, 'Message must contain 1-2000 characters');
      }

      const chatMessage = {
        room,
        username: user.username,
        message,
        sentAt: new Date().toISOString()
      };
      logger.log(`[${room}] ${user.username}: ${message}`);
      socket.to(room).emit('receiveMessage', chatMessage);
      eventBus.emit('chatMessageSent', chatMessage);
    });

    socket.on('leaveRoom', (input) => {
      const room = input && typeof input.room === 'string' ? input.room.trim() : '';
      if (!ROOM_PATTERN.test(room) || room === socket.id || !socket.rooms.has(room)) {
        return emitError(socket, 'You are not in that room');
      }

      socket.leave(room);
      logger.log(`${socket.id} left room ${room}`);
      socket.to(room).emit('userLeft', { username: user.username, room });
    });

    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room !== socket.id) {
          socket.to(room).emit('userLeft', { username: user.username, room });
        }
      }
    });

    socket.on('disconnect', () => logger.log(`User disconnected: ${socket.id}`));
  });
}

module.exports = initializeSocketService;
