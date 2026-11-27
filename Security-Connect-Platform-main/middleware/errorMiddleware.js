function notFoundHandler(req, res) {
  res.status(404).json({ message: 'Route not found' });
}

function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error.code === 11000) {
    return res.status(409).json({ message: 'Email is already registered' });
  }

  if (error.name === 'BSONError' || error.name === 'TypeError' && error.message.includes('ObjectId')) {
    return res.status(400).json({ message: 'Invalid resource ID' });
  }

  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;
  const message = status === 500 ? 'Internal server error' : error.message;

  if (process.env.NODE_ENV !== 'production' && status === 500) {
    console.error(error);
  }
  return res.status(status).json({ message });
}

module.exports = { notFoundHandler, errorHandler };
