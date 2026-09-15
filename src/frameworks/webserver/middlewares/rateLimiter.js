const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { config } = require("../../../config/config");

/**
 * Rate limit global per IP (RATE_LIMIT_MAX per RATE_LIMIT_WINDOW_MS).
 * /api/auth/me & /api/auth/refresh dikecualiin karena punya limiter sendiri.
 *
 * Dipake di: server.js → createServer (semua request).
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
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
