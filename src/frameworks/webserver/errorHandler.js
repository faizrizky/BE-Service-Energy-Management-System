const logger = require('../helpers/logger');

/**
 * Error handler Express paling akhir: status diambil dari err.status (default
 * 500), pesan internal disembunyiin kalo 500, detail cuma muncul di luar
 * production.
 *
 * Dipake di: server.js → createServer (dipasang paling akhir).
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  logger.error(err.stack || err.message);

  const status = err.status || 500;
  res.status(status).json({
    message: status === 500 ? 'Terjadi kesalahan pada server' : err.message,
    ...(process.env.NODE_ENV !== 'production' && { detail: err.message }),
  });
}

/**
 * Bales 404 JSON buat route yang nggak dikenal.
 *
 * Dipake di: server.js → createServer (abis semua route).
 */
function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} tidak ditemukan` });
}

module.exports = { errorHandler, notFoundHandler };
