const jwt = require("jsonwebtoken");
const { config } = require("../../../config/config");
const { isSessionRevoked } = require("../../helpers/sessionRevocation");
const logger = require("../../helpers/logger");

/**
 * Ngecek header Authorization: Bearer <JWT>, nolak token yang sesinya udah
 * dicabut lewat logout, terus naro isi token di req.user. Bales 401 kalo
 * token nggak ada, nggak valid, kadaluarsa, atau udah logout; 503 kalo Redis
 * nggak bisa dicek (lebih aman nolak daripada ngelolosin token yang mungkin
 * udah dicabut).
 *
 * Dipake di:
 * - router.use di routes dashboard, device, gateway, report, role, room,
 *   schedule, user
 * - auth.routes.js → GET /api/auth/me.
 */
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token tidak ditemukan" });
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = jwt.verify(token, config.jwt.secret);
  } catch (err) {
    return res
      .status(401)
      .json({ message: "Token tidak valid atau kadaluarsa" });
  }

  try {
    if (await isSessionRevoked(decoded.sid)) {
      return res
        .status(401)
        .json({ message: "Sesi sudah berakhir, silakan login ulang" });
    }
  } catch (err) {
    logger.error("[Auth] Gagal cek status sesi di Redis:", err.message);
    return res
      .status(503)
      .json({ message: "Layanan sesi sedang bermasalah, coba lagi" });
  }

  req.user = decoded;
  next();
}

module.exports = authMiddleware;
