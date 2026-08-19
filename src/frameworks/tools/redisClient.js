const Redis = require('ioredis');
const { config } = require('../../config/config');
const logger = require('../helpers/logger');

let redisClient;

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

function getRedisClient() {
  if (!redisClient) {
    throw new Error('Redis client belum diinisialisasi, panggil connectRedis() dulu');
  }
  return redisClient;
}

module.exports = { connectRedis, getRedisClient };
