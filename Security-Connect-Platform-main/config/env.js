const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function loadConfig(env = process.env) {
  const required = [
    'MONGODB_URI',
    'JWT_SECRET',
    'JWT_EXPIRES_IN',
    'BCRYPT_SALT_ROUNDS',
    'ADMIN_USERNAME',
    'ADMIN_EMAIL',
    'ADMIN_PASSWORD'
  ];
  const missing = required.filter((name) => !env[name] || !env[name].trim());

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  const saltRounds = Number(env.BCRYPT_SALT_ROUNDS);
  if (!Number.isInteger(saltRounds) || saltRounds < 4 || saltRounds > 31) {
    throw new Error('BCRYPT_SALT_ROUNDS must be an integer between 4 and 31');
  }

  if (env.JWT_SECRET.length < 32 || env.JWT_SECRET === 'replace_with_a_long_random_secret') {
    throw new Error('JWT_SECRET must be a non-default secret of at least 32 characters');
  }

  if (!EMAIL_PATTERN.test(env.ADMIN_EMAIL)) {
    throw new Error('ADMIN_EMAIL must be a valid email address');
  }

  const port = Number(env.PORT || 5000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }

  return {
    port,
    mongodbUri: env.MONGODB_URI,
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    bcryptSaltRounds: saltRounds,
    adminUsername: env.ADMIN_USERNAME.trim(),
    adminEmail: env.ADMIN_EMAIL.trim().toLowerCase(),
    adminPassword: env.ADMIN_PASSWORD
  };
}

module.exports = { loadConfig };
