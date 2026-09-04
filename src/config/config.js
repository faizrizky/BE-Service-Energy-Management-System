const { rateLimit } = require("express-rate-limit");

require("dotenv").config();

/**
 * Environment variable di setiap module,
 */
const config = {
  app: {
    port: parseInt(process.env.PORT, 10) || 4000,
    env: process.env.NODE_ENV || "development",
    forceHttps: process.env.FORCE_HTTPS === "true",
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || "1h",
    refreshExpiresDays: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS, 10) || 7,
  },
  thingsboard: {
    baseUrl: process.env.TB_URL,
    apiKey: process.env.TB_API_KEY,
    webhookSecret: process.env.TB_WEBHOOK_SECRET,
  },

  energyRetention: {
    days: parseInt(process.env.ENERGY_RETENTION_DAYS, 10) || 90,
  },

  cors: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 300,
    authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX, 10) || 10,
    powerMax: parseInt(process.env.RATE_LIMIT_POWER_MAX, 10) || 20,
  },

  turnstile: {
    secretKey: process.env.TURNSTILE_SECRET_KEY,
    enabled: Boolean(process.env.TURNSTILE_SECRET_KEY),
  },
  loginSecurity: {
    maxFailedAttempts: parseInt(process.env.LOGIN_MAX_FAILED_ATTEMPTS, 10) || 5,
    lockoutMinutes: parseInt(process.env.LOGIN_LOCKOUT_MINUTES, 10) || 15,
  },
};

function validateConfig() {
  const required = [
    ["DATABASE_URL", config.database.url],
    ["JWT_SECRET", config.jwt.secret],
    ["TB_URL", config.thingsboard.baseUrl],
    ["TB_API_KEY", config.thingsboard.apiKey],
    ["TB_WEBHOOK_SECRET", config.thingsboard.webhookSecret],
  ];

  const missing = required.filter(([, value]) => !value).map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Environment variable belum diisi: ${missing.join(", ")}`);
  }
}

module.exports = { config, validateConfig };
