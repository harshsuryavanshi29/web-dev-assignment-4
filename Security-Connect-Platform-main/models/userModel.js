const { ObjectId } = require('mongodb');

const SAFE_USER_PROJECTION = {
  projection: { password: 0 }
};

function usersCollection() {
  return require('../config/db').getCollection('users');
}

async function findUserByEmail(email) {
  return usersCollection().findOne({ email: email.toLowerCase() });
}

async function createUser({ username, email, password, role = 'user' }) {
  const now = new Date();
  const user = {
    username: username.trim(),
    email: email.trim().toLowerCase(),
    password,
    role,
    createdAt: now,
    updatedAt: now
  };
  const result = await usersCollection().insertOne(user);
  return { ...user, _id: result.insertedId };
}

async function findPublicUserById(id) {
  return usersCollection().findOne({ _id: new ObjectId(id) }, SAFE_USER_PROJECTION);
}

async function findPublicUsers() {
  return usersCollection()
    .find({}, SAFE_USER_PROJECTION)
    .sort({ createdAt: -1 })
    .toArray();
}

async function countUsers() {
  return usersCollection().countDocuments();
}

module.exports = {
  usersCollection,
  findUserByEmail,
  createUser,
  findPublicUserById,
  findPublicUsers,
  countUsers
};
