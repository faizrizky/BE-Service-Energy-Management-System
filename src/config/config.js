require("dotenv").config();

/**
 * Environment variable di setiap module,
 */
const config = {
  app: {
    port: parseInt(process.env.PORT, 10) || 4000,
    env: process.env.NODE_ENV || "development",
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
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  },
  thingsboard: {
    baseUrl: process.env.TB_URL,
    apiKey: process.env.TB_API_KEY,
    webhookSecret: process.env.TB_WEBHOOK_SECRET,
  },

  energyRetention: {
    days: parseInt(process.env.ENERGY_RETENTION_DAYS, 10) || 90,
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
