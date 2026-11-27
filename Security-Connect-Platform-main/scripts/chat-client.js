const readline = require('node:readline');
const { io } = require('socket.io-client');

const token = process.env.SOCKET_TOKEN;
const initialRoom = process.env.CHAT_ROOM || 'general';
let currentRoom = initialRoom;
if (!token) {
  console.error('Set SOCKET_TOKEN to a JWT returned by POST /api/auth/login.');
  process.exit(1);
}

const socket = io(process.env.CHAT_SERVER_URL || 'http://localhost:5000', {
  auth: { token }
});

socket.on('connect', () => {
  console.log(`Connected as ${socket.id}. Room: ${initialRoom}`);
  console.log('Type a message, /join <room>, /leave <room>, or /quit.');
  socket.emit('joinRoom', { room: initialRoom });
});
socket.on('connect_error', (error) => console.error(`Connection failed: ${error.message}`));
socket.on('roomJoined', ({ room }) => {
  currentRoom = room;
  console.log(`Joined room: ${room}`);
});
socket.on('userJoined', ({ username, room }) => console.log(`${username} joined ${room}`));
socket.on('userLeft', ({ username, room }) => console.log(`${username} left ${room}`));
socket.on('receiveMessage', ({ room, username, message, sentAt }) => {
  console.log(`[${sentAt}] [${room}] ${username}: ${message}`);
});
socket.on('errorMessage', ({ message }) => console.error(`Chat error: ${message}`));

const input = readline.createInterface({ input: process.stdin, output: process.stdout });
input.on('line', (line) => {
  const text = line.trim();
  if (text === '/quit') {
    socket.disconnect();
    input.close();
    return;
  }
  if (text.startsWith('/join ')) {
    socket.emit('joinRoom', { room: text.slice(6).trim() });
    return;
  }
  if (text.startsWith('/leave ')) {
    socket.emit('leaveRoom', { room: text.slice(7).trim() });
    return;
  }
  if (text) {
    socket.emit('chatMessage', { room: currentRoom, message: text });
  }
});

input.on('close', () => process.exit(0));
