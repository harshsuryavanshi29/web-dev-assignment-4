const jwt = require('jsonwebtoken');

function generateToken(user, config) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      username: user.username
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

module.exports = generateToken;
