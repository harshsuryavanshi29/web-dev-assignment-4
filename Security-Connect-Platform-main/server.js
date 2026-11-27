require('dotenv').config();

const http = require('node:http');
const express = require('express');
const { Server } = require('socket.io');
const { loadConfig } = require('./config/env');
const { connectToDatabase, closeDatabase, getDatabase } = require('./config/db');
const createAuthMiddleware = require('./middleware/authMiddleware');
const { notFoundHandler, errorHandler } = require('./middleware/errorMiddleware');
const createAuthRoutes = require('./routes/authRoutes');
const createNoteRoutes = require('./routes/noteRoutes');
const createAdminRoutes = require('./routes/adminRoutes');
const initializeSocketService = require('./services/socketService');
const { initializeEventListeners } = require('./services/eventService');
const { initializeAdminAccount } = require('./controllers/authController');

function createApp(config) {
  const app = express();
  const authenticate = createAuthMiddleware(config);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/health', async (req, res, next) => {
    try {
      await getDatabase().command({ ping: 1 });
      return res.status(200).json({ status: 'ok', database: 'connected' });
    } catch (error) {
      return next(error);
    }
  });
  app.use('/api/auth', createAuthRoutes(config, authenticate));
  app.use('/api/notes', createNoteRoutes(authenticate));
  app.use('/api/admin', createAdminRoutes(authenticate));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

async function startServer() {
  const config = loadConfig();
  await connectToDatabase(config.mongodbUri);
  await initializeAdminAccount(config);
  initializeEventListeners();

  const app = createApp(config);
  const httpServer = http.createServer(app);
  const io = new Server(httpServer);
  initializeSocketService(io, config);

  await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(config.port, () => {
      httpServer.removeListener('error', reject);
      console.log(`[server] listening on http://localhost:${config.port}`);
      resolve();
    });
  });

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    console.log(`[server] ${signal} received; shutting down`);
    await new Promise((resolve) => io.close(resolve));
    await closeDatabase();
  }

  process.once('SIGINT', () => shutdown('SIGINT').catch((error) => {
    console.error('[server] shutdown failed', error);
    process.exitCode = 1;
  }));
  process.once('SIGTERM', () => shutdown('SIGTERM').catch((error) => {
    console.error('[server] shutdown failed', error);
    process.exitCode = 1;
  }));

  return { app, httpServer, io, shutdown };
}

if (require.main === module) {
  startServer().catch(async (error) => {
    console.error('[server] startup failed:', error.message);
    try {
      await closeDatabase();
    } catch (closeError) {
      console.error('[server] database cleanup failed:', closeError.message);
    }
    process.exitCode = 1;
  });
}

module.exports = { createApp, startServer };
