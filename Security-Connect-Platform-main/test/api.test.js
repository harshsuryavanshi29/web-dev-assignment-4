const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const http = require('node:http');
const test = require('node:test');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { io: createSocketClient } = require('socket.io-client');
const { loadConfig } = require('../config/env');
const { connectToDatabase, closeDatabase, getCollection } = require('../config/db');
const { initializeAdminAccount } = require('../controllers/authController');
const { createApp } = require('../server');
const { initializeEventListeners } = require('../services/eventService');
const initializeSocketService = require('../services/socketService');

const suffix = randomUUID();
const testUser = { username: 'test-user', email: `test-${suffix}@example.com`, password: 'TestPassword123!' };
const secondUser = {
  username: 'second-user',
  email: `second-${suffix}@example.com`,
  password: 'TestPassword123!'
};
const testAdmin = {
  username: 'test-admin',
  email: `admin-${suffix}@example.com`,
  password: 'TestAdminPassword123!'
};
let config;
let httpServer;
let ioServer;
let baseUrl;
let testUserId;
let secondUserId;
let databaseConnected = false;
let baselineNoteCount;

async function request(path, { token, method = 'GET', body } = {}) {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const responseBody = await response.json();
  return { response, body: responseBody };
}

function connectSocket(token) {
  const socket = createSocketClient(baseUrl, {
    auth: { token },
    reconnection: false,
    timeout: 3000
  });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function nextSocketEvent(socket, eventName, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${eventName}`)), timeoutMs);
    socket.once(eventName, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

function nextRoomJoined(socket, expectedRoom) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('roomJoined', onRoomJoined);
      reject(new Error(`Timed out waiting to join ${expectedRoom}`));
    }, 3000);
    function onRoomJoined({ room }) {
      if (room === expectedRoom) {
        clearTimeout(timer);
        socket.off('roomJoined', onRoomJoined);
        resolve(room);
      }
    }
    socket.on('roomJoined', onRoomJoined);
  });
}

test('MongoDB-backed API authorization, notes CRUD, admin RBAC, and authenticated chat', async () => {
  process.env.PORT = '5000';
  process.env.MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/secure_connect_db';
  process.env.JWT_SECRET = `test-secret-${suffix}-long-enough-for-integration`;
  process.env.JWT_EXPIRES_IN = '1h';
  process.env.BCRYPT_SALT_ROUNDS = '4';
  process.env.ADMIN_USERNAME = testAdmin.username;
  process.env.ADMIN_EMAIL = testAdmin.email;
  process.env.ADMIN_PASSWORD = testAdmin.password;

  let firstSocket;
  let secondSocket;
  let apiStarted = false;
  try {
    config = loadConfig();
    await connectToDatabase(config.mongodbUri);
    databaseConnected = true;
    baselineNoteCount = await getCollection('notes').countDocuments();
    await initializeAdminAccount(config);

    const originalAdmin = await getCollection('users').findOne({ email: testAdmin.email });
    const updatedAdminConfig = {
      ...config,
      adminPassword: 'ChangedAdminPassword123!',
      adminUsername: 'renamed-test-admin'
    };
    await initializeAdminAccount(updatedAdminConfig);
    const reconciledAdmin = await getCollection('users').findOne({ email: testAdmin.email });
    assert.equal(reconciledAdmin._id.toString(), originalAdmin._id.toString());
    assert.equal(reconciledAdmin.role, 'admin');
    assert.equal(reconciledAdmin.username, updatedAdminConfig.adminUsername);
    assert.equal(await bcrypt.compare(updatedAdminConfig.adminPassword, reconciledAdmin.password), true);
    assert.equal(await bcrypt.compare(testAdmin.password, reconciledAdmin.password), false);

    initializeEventListeners({ log() {} });

    httpServer = http.createServer(createApp(config));
    ioServer = new Server(httpServer);
    initializeSocketService(ioServer, config, { log() {} });
    await new Promise((resolve, reject) => {
      httpServer.once('error', reject);
      httpServer.listen(0, '127.0.0.1', resolve);
    });
    baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
    apiStarted = true;

    let result = await request('/api/health');
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body, { status: 'ok', database: 'connected' });

    result = await request('/api/auth/signup', {
      method: 'POST',
      body: { ...testUser, role: 'admin' }
    });
    assert.equal(result.response.status, 201);
    testUserId = result.body.id;
    assert.equal(result.body.role, undefined);
    assert.equal(result.body.password, undefined);

    result = await request('/api/auth/signup', {
      method: 'POST',
      body: { ...secondUser, role: 'user' }
    });
    assert.equal(result.response.status, 201);
    secondUserId = result.body.id;

    result = await request('/api/auth/signup', { method: 'POST', body: testUser });
    assert.equal(result.response.status, 409);
    result = await request('/api/auth/signup', {
      method: 'POST',
      body: { username: 'missing-email', password: 'TestPassword123!' }
    });
    assert.equal(result.response.status, 400);

    result = await request('/api/auth/login', {
      method: 'POST',
      body: { email: testUser.email, password: 'wrong-password' }
    });
    assert.equal(result.response.status, 401);

    const userLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: testUser.email, password: testUser.password }
    });
    assert.equal(userLogin.response.status, 200);
    const userToken = userLogin.body.token;
    const secondLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: secondUser.email, password: secondUser.password }
    });
    assert.equal(secondLogin.response.status, 200);

    const storedUser = await getCollection('users').findOne({ email: testUser.email });
    assert.notEqual(storedUser.password, testUser.password);
    assert.equal(await bcrypt.compare(testUser.password, storedUser.password), true);

    result = await request('/api/auth/me', { token: userToken });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.role, 'user');
    assert.equal(result.body.password, undefined);
    result = await request('/api/notes');
    assert.equal(result.response.status, 403);
    assert.equal(result.body.message, 'No token provided');
    result = await request('/api/notes', { token: 'not-a-valid-jwt' });
    assert.equal(result.response.status, 401);
    const expiredToken = jwt.sign(
      { sub: testUserId, role: 'user', username: testUser.username },
      config.jwtSecret,
      { expiresIn: -1 }
    );
    result = await request('/api/notes', { token: expiredToken });
    assert.equal(result.response.status, 401);
    assert.equal(result.body.message, 'Authentication token has expired');

    result = await request('/api/notes', {
      token: userToken,
      method: 'POST',
      body: { title: '   ', content: 'invalid' }
    });
    assert.equal(result.response.status, 400);

    const created = await request('/api/notes', {
      token: userToken,
      method: 'POST',
      body: { title: 'Owned note', content: 'Private content', owner: secondUserId }
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.body.owner, testUserId);
    const noteId = created.body._id;

    result = await request('/api/notes', { token: userToken });
    assert.equal(result.response.status, 200);
    assert.deepEqual(result.body.map((note) => note._id), [noteId]);
    result = await request(`/api/notes/${noteId}`, { token: userToken });
    assert.equal(result.response.status, 200);

    result = await request(`/api/notes/${noteId}`, { token: secondLogin.body.token });
    assert.equal(result.response.status, 404);
    result = await request(`/api/notes/${noteId}`, {
      token: secondLogin.body.token,
      method: 'PUT',
      body: { title: 'Stolen', content: 'No' }
    });
    assert.equal(result.response.status, 404);
    result = await request(`/api/notes/${noteId}`, {
      token: secondLogin.body.token,
      method: 'DELETE'
    });
    assert.equal(result.response.status, 404);

    result = await request(`/api/notes/${noteId}`, {
      token: userToken,
      method: 'PUT',
      body: { title: 'Updated note', content: 'Updated text', owner: secondUserId }
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.title, 'Updated note');
    assert.equal(result.body.owner, testUserId);
    result = await request(`/api/notes/${noteId}`, { token: userToken, method: 'DELETE' });
    assert.equal(result.response.status, 200);
    result = await request(`/api/notes/${noteId}`, { token: userToken });
    assert.equal(result.response.status, 404);
    result = await request('/api/notes/not-an-object-id', { token: userToken });
    assert.equal(result.response.status, 400);

    const adminLogin = await request('/api/auth/login', {
      method: 'POST',
      body: { email: testAdmin.email, password: updatedAdminConfig.adminPassword }
    });
    assert.equal(adminLogin.response.status, 200);
    const adminToken = adminLogin.body.token;
    const adminClaims = jwt.verify(adminToken, config.jwtSecret);
    assert.equal(adminClaims.sub, originalAdmin._id.toString());
    assert.equal(adminClaims.role, 'admin');
    result = await request('/api/admin/users', { token: userToken });
    assert.equal(result.response.status, 403);
    result = await request('/api/admin/users', { token: adminToken });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.some((user) => user._id === testUserId), true);
    assert.equal(result.body.some((user) => Object.hasOwn(user, 'password')), false);
    result = await request(`/api/admin/users/${testUserId}`, { token: adminToken });
    assert.equal(result.response.status, 200);
    result = await request('/api/admin/stats', { token: adminToken });
    assert.equal(result.response.status, 200);
    assert.ok(result.body.users >= 3);
    assert.equal(result.body.notes, baselineNoteCount);

    await assert.rejects(connectSocket('invalid-token'));
    firstSocket = await connectSocket(userToken);
    secondSocket = await connectSocket(secondLogin.body.token);
    const firstJoined = nextRoomJoined(firstSocket, 'lab');
    const secondJoined = nextRoomJoined(secondSocket, 'lab');
    firstSocket.emit('joinRoom', { room: 'lab' });
    secondSocket.emit('joinRoom', { room: 'lab' });
    assert.equal(await firstJoined, 'lab');
    assert.equal(await secondJoined, 'lab');

    const received = nextSocketEvent(secondSocket, 'receiveMessage');
    firstSocket.emit('chatMessage', {
      room: 'lab',
      username: 'forged-name',
      message: 'Hello from an authenticated client'
    });
    const chatMessage = await received;
    assert.equal(chatMessage.username, testUser.username);
    assert.equal(chatMessage.message, 'Hello from an authenticated client');

    const chatError = nextSocketEvent(firstSocket, 'errorMessage');
    firstSocket.emit('chatMessage', { room: 'lab', message: '   ' });
    assert.match((await chatError).message, /1-2000 characters/);
  } finally {
    if (firstSocket) firstSocket.disconnect();
    if (secondSocket) secondSocket.disconnect();
    if (ioServer) {
      await new Promise((resolve) => ioServer.close(resolve));
    } else if (apiStarted && httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }

    if (databaseConnected) {
      const users = getCollection('users');
      const testUsers = await users.find(
        { email: { $in: [testUser.email, secondUser.email, testAdmin.email] } },
        { projection: { _id: 1 } }
      ).toArray();
      const ids = testUsers.map((user) => user._id);
      if (ids.length > 0) {
        await getCollection('notes').deleteMany({ owner: { $in: ids } });
        await users.deleteMany({ _id: { $in: ids } });
      }
    }
    await closeDatabase();
  }
});
