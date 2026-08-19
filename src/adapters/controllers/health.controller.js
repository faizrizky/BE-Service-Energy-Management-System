const { prisma } = require('../../frameworks/database/prismaClient');
const { getRedisClient } = require('../../frameworks/tools/redisClient');

/**
 * Health check - cek app, database, dan redis On/Off.
 */
async function healthCheck(req, res) {
  const result = { app: 'ok', database: 'unknown', redis: 'unknown' };

  try {
    await prisma.$queryRaw`SELECT 1`;
    result.database = 'ok';
  } catch (err) {
    result.database = `error: ${err.message}`;
  }

  try {
    const pong = await getRedisClient().ping();
    result.redis = pong === 'PONG' ? 'ok' : 'unexpected response';
  } catch (err) {
    result.redis = `error: ${err.message}`;
  }

  const allOk = result.database === 'ok' && result.redis === 'ok';
  res.status(allOk ? 200 : 503).json(result);
}

module.exports = { healthCheck };
