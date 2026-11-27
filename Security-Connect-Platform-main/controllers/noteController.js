const { ObjectId } = require('mongodb');
const {
  createNote,
  findNotesByOwner,
  findNoteByIdAndOwner,
  updateNoteByIdAndOwner,
  deleteNoteByIdAndOwner
} = require('../models/noteModel');
const { eventBus } = require('../services/eventService');
const { validateNote } = require('../utils/validation');

function validId(id) {
  return ObjectId.isValid(id) && new ObjectId(id).toString() === id.toLowerCase();
}

function createNoteController() {
  return {
    create: async (req, res) => {
      const validationError = validateNote(req.body || {});
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const note = await createNote({
        title: req.body.title,
        content: req.body.content,
        owner: new ObjectId(req.user.id)
      });
      eventBus.emit('noteCreated', { id: note._id.toString(), title: note.title });
      return res.status(201).json({ ...note, _id: note._id.toString(), owner: note.owner.toString() });
    },

    list: async (req, res) => {
      const notes = await findNotesByOwner(new ObjectId(req.user.id));
      return res.status(200).json(notes.map((note) => ({
        ...note,
        _id: note._id.toString(),
        owner: note.owner.toString()
      })));
    },

    get: async (req, res) => {
      if (!validId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }
      const note = await findNoteByIdAndOwner(req.params.id, new ObjectId(req.user.id));
      if (!note) {
        return res.status(404).json({ message: 'Note not found' });
      }
      return res.status(200).json({ ...note, _id: note._id.toString(), owner: note.owner.toString() });
    },

    update: async (req, res) => {
      if (!validId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }
      const validationError = validateNote(req.body || {});
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const note = await updateNoteByIdAndOwner(
        req.params.id,
        new ObjectId(req.user.id),
        { title: req.body.title, content: req.body.content }
      );
      if (!note) {
        return res.status(404).json({ message: 'Note not found' });
      }
      eventBus.emit('noteUpdated', { id: note._id.toString(), title: note.title });
      return res.status(200).json({ ...note, _id: note._id.toString(), owner: note.owner.toString() });
    },

    remove: async (req, res) => {
      if (!validId(req.params.id)) {
        return res.status(400).json({ message: 'Invalid note ID' });
      }
      const result = await deleteNoteByIdAndOwner(req.params.id, new ObjectId(req.user.id));
      if (result.deletedCount === 0) {
        return res.status(404).json({ message: 'Note not found' });
      }
      eventBus.emit('noteDeleted', { id: req.params.id });
      return res.status(200).json({ message: 'Note deleted successfully' });
    }
  };
}

module.exports = createNoteController;
