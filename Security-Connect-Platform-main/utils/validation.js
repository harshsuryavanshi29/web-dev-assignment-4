const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validEmail(value) {
  return typeof value === 'string' && EMAIL_PATTERN.test(value.trim());
}

function validateCredentials({ username, email, password }) {
  if (typeof username !== 'string' || !username.trim()) {
    return 'Username is required';
  }
  if (!validEmail(email)) {
    return 'A valid email is required';
  }
  if (typeof password !== 'string' || password.length < 6) {
    return 'Password is required and must be at least 6 characters';
  }
  return null;
}

function validateNote({ title, content }) {
  if (typeof title !== 'string' || !title.trim()) {
    return 'Title is required';
  }
  if (typeof content !== 'string' || !content.trim()) {
    return 'Content is required';
  }
  return null;
}

module.exports = { validEmail, validateCredentials, validateNote };
