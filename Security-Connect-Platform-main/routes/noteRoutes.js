const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const createNoteController = require('../controllers/noteController');

function createNoteRoutes(authenticate) {
  const router = express.Router();
  const controller = createNoteController();

  router.use(authenticate);
  router.post('/', asyncHandler(controller.create));
  router.get('/', asyncHandler(controller.list));
  router.get('/:id', asyncHandler(controller.get));
  router.put('/:id', asyncHandler(controller.update));
  router.delete('/:id', asyncHandler(controller.remove));
  return router;
}

module.exports = createNoteRoutes;
