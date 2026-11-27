const bcrypt = require('bcrypt');
const { findUserByEmail, createUser, findPublicUserById } = require('../models/userModel');
const { eventBus } = require('../services/eventService');
const generateToken = require('../utils/generateToken');
const { validateCredentials, validEmail } = require('../utils/validation');

function createAuthController(config) {
  return {
    signup: async (req, res) => {
      const validationError = validateCredentials(req.body || {});
      if (validationError) {
        return res.status(400).json({ message: validationError });
      }

      const { username, email, password } = req.body;
      if (await findUserByEmail(email.trim().toLowerCase())) {
        return res.status(409).json({ message: 'Email is already registered' });
      }

      const hashedPassword = await bcrypt.hash(password, config.bcryptSaltRounds);
      let user;
      try {
        user = await createUser({
          username,
          email,
          password: hashedPassword,
          role: 'user'
        });
      } catch (error) {
        if (error.code === 11000) {
          return res.status(409).json({ message: 'Email is already registered' });
        }
        throw error;
      }

      eventBus.emit('userRegistered', { id: user._id.toString(), email: user.email });
      return res.status(201).json({
        message: 'User registered',
        id: user._id.toString(),
        username: user.username,
        email: user.email
      });
    },

    login: async (req, res) => {
      const { email, password } = req.body || {};
      if (!validEmail(email) || typeof password !== 'string' || !password) {
        return res.status(400).json({ message: 'A valid email and password are required' });
      }

      const user = await findUserByEmail(email.trim().toLowerCase());
      if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }

      const token = generateToken(user, config);
      eventBus.emit('userLoggedIn', { id: user._id.toString(), email: user.email });
      return res.status(200).json({ message: 'Login successful', token });
    },

    me: async (req, res) => {
      const user = await findPublicUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.status(200).json({
        id: user._id.toString(),
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      });
    }
  };
}

async function initializeAdminAccount(config) {
  const { findUserByEmail, createUser } = require('../models/userModel');
  const existingAdmin = await findUserByEmail(config.adminEmail);

  if (existingAdmin) {
    if (existingAdmin.role !== 'admin') {
      throw new Error('Configured ADMIN_EMAIL already belongs to a non-admin account');
    }

    const passwordMatches = await bcrypt.compare(config.adminPassword, existingAdmin.password);
    const usernameMatches = existingAdmin.username === config.adminUsername;
    if (!passwordMatches || !usernameMatches) {
      const updates = {
        username: config.adminUsername,
        updatedAt: new Date()
      };
      if (!passwordMatches) {
        updates.password = await bcrypt.hash(config.adminPassword, config.bcryptSaltRounds);
      }

      const { getCollection } = require('../config/db');
      await getCollection('users').updateOne(
        { _id: existingAdmin._id, role: 'admin' },
        { $set: updates }
      );
    }
    return;
  }

  const password = await bcrypt.hash(config.adminPassword, config.bcryptSaltRounds);
  try {
    await createUser({
      username: config.adminUsername,
      email: config.adminEmail,
      password,
      role: 'admin'
    });
  } catch (error) {
    if (error.code !== 11000) {
      throw error;
    }
    const user = await findUserByEmail(config.adminEmail);
    if (!user || user.role !== 'admin') {
      throw error;
    }
  }
}

module.exports = { createAuthController, initializeAdminAccount };
