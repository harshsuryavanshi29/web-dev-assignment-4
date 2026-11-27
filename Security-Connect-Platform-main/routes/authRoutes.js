const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const { createAuthController } = require('../controllers/authController');

function createAuthRoutes(config, authenticate) {
  const router = express.Router();
  const controller = createAuthController(config);

  router.post('/signup', asyncHandler(controller.signup));
  router.post('/login', asyncHandler(controller.login));
  router.get('/me', authenticate, asyncHandler(controller.me));
  return router;
}

module.exports = createAuthRoutes;
