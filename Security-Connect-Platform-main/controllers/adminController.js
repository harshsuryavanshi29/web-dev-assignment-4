const { ObjectId } = require('mongodb');
const { findPublicUserById, findPublicUsers, countUsers } = require('../models/userModel');
const { countNotes } = require('../models/noteModel');

function createAdminController() {
  return {
    listUsers: async (req, res) => {
      const users = await findPublicUsers();
      return res.status(200).json(users.map((user) => ({
        ...user,
        _id: user._id.toString()
      })));
    },

    getUser: async (req, res) => {
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
      const user = await findPublicUserById(req.params.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.status(200).json({ ...user, _id: user._id.toString() });
    },

    stats: async (req, res) => {
      const [users, notes] = await Promise.all([countUsers(), countNotes()]);
      return res.status(200).json({ users, notes });
    }
  };
}

module.exports = createAdminController;
