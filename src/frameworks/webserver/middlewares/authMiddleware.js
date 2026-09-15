const jwt = require('jsonwebtoken');
const { config } = require('../../../config/config');

/**
 * Ngecek header Authorization: Bearer <JWT> terus naro isi token di req.user.
 * Bales 401 kalo token nggak ada, nggak valid, atau kadaluarsa.
 *
 * Dipake di:
 * - router.use di routes dashboard, device, gateway, report, role, room,
 *   schedule, user
 * - auth.routes.js → GET /api/auth/me.
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token tidak ditemukan' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token tidak valid atau kadaluarsa' });
  }
}

module.exports = authMiddleware;