const rateLimit = require("express-rate-limit");
const crypto = require("crypto");
const { config } = require("../../../config/config");

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    req.path === "/api/auth/me" || req.path === "/api/auth/refresh",
  message: { message: "Terlalu banyak request, coba lagi nanti" },
});

const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Terlalu banyak percobaan login, coba lagi nanti" },
});

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

const powerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.powerMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { message: "Terlalu sering mengubah status power, tunggu sebentar" },
});

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
