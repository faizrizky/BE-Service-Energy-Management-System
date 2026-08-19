require('dotenv').config();

/**
 * Environment variable di setiap module,
 */
const config = {
  app: {
    port: parseInt(process.env.PORT, 10) || 4000,
    env: process.env.NODE_ENV || 'development',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  },
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL,
    username: process.env.MQTT_USERNAME || undefined,
    password: process.env.MQTT_PASSWORD || undefined,
  },
};

function validateConfig() {
  const required = [
    ['DATABASE_URL', config.database.url],
    ['JWT_SECRET', config.jwt.secret],
  ];

  const missing = required.filter(([, value]) => !value).map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Environment variable belum diisi: ${missing.join(', ')}`);
  }
}

module.exports = { config, validateConfig };
