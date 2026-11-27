const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const requireRole = require('../middleware/roleMiddleware');
const createAdminController = require('../controllers/adminController');

function createAdminRoutes(authenticate) {
  const router = express.Router();
  const controller = createAdminController();

  router.use(authenticate, requireRole('admin'));
  router.get('/users', asyncHandler(controller.listUsers));
  router.get('/users/:id', asyncHandler(controller.getUser));
  router.get('/stats', asyncHandler(controller.stats));
  return router;
}

module.exports = createAdminRoutes;
