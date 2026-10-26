const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { config } = require("../../../config/config");
const jwt = require("jsonwebtoken");

/**
 * Kunci rate limit global: id user kalau token valid, kalau nggak IP. Request
 * SSR dari server FE semuanya keluar dari satu IP, jadi kalau per IP semua
 * user berbagi satu jatah. Token yang nggak valid jatuh ke IP, jadi id palsu
 * nggak bisa dipakai buat lolos dari limit.
 *
 * Dipake di: apiLimiter (file ini).
 */
function limiterKey(req) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const { id, sid } = jwt.verify(header.slice(7), config.jwt.secret);
      return sid ? `session:${sid}` : `user:${id}`;
    } catch {}
  }
  return req.ip;
}

/**
 * Rate limit global per user (token valid) atau per IP (RATE_LIMIT_MAX per RATE_LIMIT_WINDOW_MS).
 * /api/auth/me & /api/auth/refresh dikecualiin karena punya limiter sendiri.
 *
 * Dipake di: server.js → createServer (semua request).
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  keyGenerator: limiterKey,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.path === "/api/auth/me" || req.path === "/api/auth/refresh",
  message: { message: "Terlalu banyak request, coba lagi nanti" },
});

/**
 * Batesin percobaan login yang gagal per IP (RATE_LIMIT_AUTH_MAX). Login yang
 * berhasil nggak diitung.
 *
 * Dipake di: auth.routes.js → POST /api/auth/login.
 */
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Terlalu banyak percobaan login, coba lagi nanti" },
});

/**
 * Maks 10 refresh per menit per refresh token (pake hash-nya), kalo token-nya
 * nggak ada pake IP.
 *
 * Dipake di: auth.routes.js → POST /api/auth/refresh.
 */
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const token = req.body?.refreshToken;
    if (typeof token !== "string" || !token) return req.ip;
    return crypto.createHash("sha256").update(token).digest("hex");
  },
  message: { message: "Terlalu banyak percobaan refresh, coba lagi sebentar" },
});

/**
 * Batesin perintah yang ngirim downlink ke meter per user
 * (RATE_LIMIT_POWER_MAX per menit).
 *
 * Dipake di:
 * - device.routes.js → POST /:id/power, /:id/telemetry, /:id/interval
 * - room.routes.js → POST /:id/power.
 */
const powerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.powerMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { message: "Terlalu sering mengubah status power, tunggu sebentar" },
});

/**
 * Batesin pengecekan sesi per user (RATE_LIMIT_ME_MAX per menit).
 *
 * Dipake di: auth.routes.js → GET /api/auth/me.
 */
const meLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.meMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { message: "Terlalu banyak permintaan sesi, coba lagi sebentar" },
});

module.exports = {
  apiLimiter,
  authLimiter,
  refreshLimiter,
  powerLimiter,
  meLimiter,
};
