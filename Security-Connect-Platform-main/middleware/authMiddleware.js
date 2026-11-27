const jwt = require('jsonwebtoken');
const { ObjectId } = require('mongodb');
const { getCollection } = require('../config/db');

function createAuthMiddleware(config) {
  return async function authenticate(req, res, next) {
    const authorization = req.get('Authorization');
    if (!authorization || !authorization.startsWith('Bearer ')) {
      return res.status(403).json({ message: 'No token provided' });
    }

    const token = authorization.slice(7).trim();
    if (!token) {
      return res.status(403).json({ message: 'No token provided' });
    }

    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Authentication token has expired' });
      }
      return res.status(401).json({ message: 'Invalid authentication token' });
    }

    if (
      typeof payload !== 'object' ||
      typeof payload.sub !== 'string' ||
      !ObjectId.isValid(payload.sub) ||
      !['user', 'admin'].includes(payload.role)
    ) {
      return res.status(401).json({ message: 'Invalid authentication token' });
    }

    try {
      const user = await getCollection('users').findOne(
        { _id: new ObjectId(payload.sub) },
        { projection: { username: 1, role: 1 } }
      );
      if (!user || !['user', 'admin'].includes(user.role)) {
        return res.status(401).json({ message: 'Authenticated user no longer exists' });
      }

      req.user = { id: user._id.toString(), role: user.role, username: user.username };
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = createAuthMiddleware;
