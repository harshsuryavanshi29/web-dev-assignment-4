const { MongoClient } = require('mongodb');

let client;
let database;

async function connectToDatabase(uri) {
  if (!uri) {
    throw new Error('A MongoDB connection URI is required');
  }

  client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000
  });
  await client.connect();
  database = client.db('secure_connect_db');

  await Promise.all([
    database.collection('users').createIndex({ email: 1 }, { unique: true }),
    database.collection('notes').createIndex({ owner: 1, createdAt: -1 })
  ]);
  await database.command({ ping: 1 });
  return database;
}

function getDatabase() {
  if (!database) {
    throw new Error('Database has not been connected');
  }
  return database;
}

function getCollection(name) {
  return getDatabase().collection(name);
}

async function closeDatabase() {
  if (client) {
    await client.close();
    client = undefined;
    database = undefined;
  }
}

module.exports = { connectToDatabase, getDatabase, getCollection, closeDatabase };
