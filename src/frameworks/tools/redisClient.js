const Redis = require('ioredis');
const { config } = require('../../config/config');
const logger = require('../helpers/logger');

let redisClient;

/**
 * Bikin koneksi ioredis dari config dan nyatet event connect/error.
 *
 * Dipake di: app.js → bootstrap.
 */
function connectRedis() {
  redisClient = new Redis({
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    maxRetriesPerRequest: null,
  });

  redisClient.on('connect', () => {
    logger.info('[Redis] Terhubung ke Redis');
  });

  redisClient.on('error', (err) => {
    logger.error('[Redis] Connection error:', err.message);
  });

  return redisClient;
}

/**
 * Ngambil client Redis yang udah dibikin. Lempar error kalo connectRedis belom
 * dipanggil.
 *
 * Dipake di:
 * - health.controller.js → healthCheck
 * - app.js → gracefulShutdown.
 */
function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis client belum diinisialisasi, panggil connectRedis() dulu');
  }
  return redisClient;
}

module.exports = { connectRedis, getRedisClient };
