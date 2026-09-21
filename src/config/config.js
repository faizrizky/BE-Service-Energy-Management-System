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
  chirpstack: {
    baseUrl: process.env.CHIRPSTACK_MIDDLEWARE_URL,
    applicationId: process.env.CHIRPSTACK_APPLICATION_ID,
    deviceProfileId: process.env.CHIRPSTACK_DEVICE_PROFILE_ID,
    syncDelete: process.env.CHIRPSTACK_SYNC_DELETE !== "false",
    syncCreate: process.env.CHIRPSTACK_SYNC_CREATE !== "false",
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
    meMax: parseInt(process.env.RATE_LIMIT_ME_MAX, 10) || 60,
  },

  turnstile: {
    secretKey: process.env.TURNSTILE_SECRET_KEY,
    enabled: Boolean(process.env.TURNSTILE_SECRET_KEY),
  },
  loginSecurity: {
    maxFailedAttempts: parseInt(process.env.LOGIN_MAX_FAILED_ATTEMPTS, 10) || 5,
    lockoutMinutes: parseInt(process.env.LOGIN_LOCKOUT_MINUTES, 10) || 15,
  },
  deviceOnline: {
    graceMs:
      (parseInt(process.env.DEVICE_ONLINE_GRACE_SECONDS, 10) || 120) * 1000,
  },
  schedule: {
    timezone: process.env.SCHEDULE_TIMEZONE || "Asia/Jakarta",
  },
};

/**
 * Ngecek nama zona waktu IANA (misal "Asia/Jakarta") dikenal sama Intl.
 *
 * Dipake di: validateConfig (file ini).
 */
function isValidTimeZone(timeZone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ngecek env wajib (DATABASE_URL, JWT_SECRET, CHIRPSTACK_MIDDLEWARE_URL,
 * CHIRPSTACK_APPLICATION_ID) udah keisi. Kalo ada yang kosong, lempar error
 * sambil nyebutin env mana aja. SCHEDULE_TIMEZONE juga dicek harus zona waktu
 * yang valid, biar schedule nggak diem-diem jalan di jam yang salah.
 *
 * Dipake di: app.js → bootstrap (paling awal, sebelum nyambung ke apa-apa).
 */
function validateConfig() {
  const required = [
    ["DATABASE_URL", config.database.url],
    ["JWT_SECRET", config.jwt.secret],
    ["CHIRPSTACK_MIDDLEWARE_URL", config.chirpstack.baseUrl],
    ["CHIRPSTACK_APPLICATION_ID", config.chirpstack.applicationId],
  ];

  const missing = required.filter(([, value]) => !value).map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Environment variable belum diisi: ${missing.join(", ")}`);
  }

  if (!isValidTimeZone(config.schedule.timezone)) {
    throw new Error(
      `SCHEDULE_TIMEZONE tidak valid: "${config.schedule.timezone}" (contoh: Asia/Jakarta)`,
    );
  }
}

module.exports = { config, validateConfig };
