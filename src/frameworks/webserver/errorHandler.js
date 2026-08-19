const logger = require('../helpers/logger');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(err.stack || err.message);

  const status = err.status || 500;
  res.status(status).json({
    message: status === 500 ? 'Terjadi kesalahan pada server' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { detail: err.message }),
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} tidak ditemukan` });
}

module.exports = { errorHandler, notFoundHandler };
