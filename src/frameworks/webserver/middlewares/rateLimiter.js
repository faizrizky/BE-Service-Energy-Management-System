const rateLimit = require("express-rate-limit");
const { config } = require("../../../config/config");

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Terlalu banyak request, coba lagi nanti" },
});

const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: "Terlalu banyak percobaan login, coba lagi nanti" },
});

const powerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: config.rateLimit.powerMax,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip,
  message: { message: "Terlalu sering mengubah status power, tunggu sebentar" },
});

module.exports = { apiLimiter, authLimiter, powerLimiter };
