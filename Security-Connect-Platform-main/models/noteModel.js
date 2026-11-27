const { ObjectId } = require('mongodb');
const { getCollection } = require('../config/db');

function notesCollection() {
  return getCollection('notes');
}

async function createNote({ title, content, owner }) {
  const now = new Date();
  const note = { title: title.trim(), content: content.trim(), owner, createdAt: now, updatedAt: now };
  const result = await notesCollection().insertOne(note);
  return { ...note, _id: result.insertedId };
}

async function findNotesByOwner(owner) {
  return notesCollection().find({ owner }).sort({ createdAt: -1 }).toArray();
}

async function findNoteByIdAndOwner(id, owner) {
  return notesCollection().findOne({ _id: new ObjectId(id), owner });
}

async function updateNoteByIdAndOwner(id, owner, changes) {
  const result = await notesCollection().findOneAndUpdate(
    { _id: new ObjectId(id), owner },
    { $set: { title: changes.title.trim(), content: changes.content.trim(), updatedAt: new Date() } },
    { returnDocument: 'after' }
  );
  return result;
}

async function deleteNoteByIdAndOwner(id, owner) {
  return notesCollection().deleteOne({ _id: new ObjectId(id), owner });
}

async function countNotes() {
  return notesCollection().countDocuments();
}

module.exports = {
  createNote,
  findNotesByOwner,
  findNoteByIdAndOwner,
  updateNoteByIdAndOwner,
  deleteNoteByIdAndOwner,
  countNotes
};
