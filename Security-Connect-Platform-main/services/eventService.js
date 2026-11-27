const { EventEmitter } = require('node:events');

const eventBus = new EventEmitter();

const messages = {
  userRegistered: (user) => `[EVENT] User registered: ${user.email}`,
  userLoggedIn: (user) => `[EVENT] User logged in: ${user.email}`,
  noteCreated: (note) => `[EVENT] Note created: ${note.title}`,
  noteUpdated: (note) => `[EVENT] Note updated: ${note.title}`,
  noteDeleted: () => '[EVENT] Note deleted successfully',
  userConnected: (user) => `[EVENT] User connected: ${user.username}`,
  chatMessageSent: (message) => `[EVENT] Chat message sent in room: ${message.room}`
};

function initializeEventListeners(logger = console) {
  for (const [eventName, formatMessage] of Object.entries(messages)) {
    eventBus.on(eventName, (payload) => logger.log(formatMessage(payload)));
  }
}

module.exports = { eventBus, initializeEventListeners };
