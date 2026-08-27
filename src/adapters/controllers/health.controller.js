const { prisma } = require("../../frameworks/database/prismaClient");
const { getRedisClient } = require("../../frameworks/tools/redisClient");
const { tbRequest } = require("../../frameworks/thingsboard/client");

/**
 * Health check - cek app, database, redis, dan konektivitas ThingsBoard.
 */
async function healthCheck(req, res) {
  const result = {
    app: "ok",
    database: "unknown",
    redis: "unknown",
    thingsboard: "unknown",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    result.database = "ok";
  } catch (err) {
    result.database = `error: ${err.message}`;
  }

  try {
    const pong = await getRedisClient().ping();
    result.redis = pong === "PONG" ? "ok" : "unexpected response";
  } catch (err) {
    result.redis = `error: ${err.message}`;
  }

  try {
    await tbRequest("/api/auth/user");
    result.thingsboard = "ok";
  } catch (err) {
    result.thingsboard = `error: ${err.message}`;
  }

  const allOk =
    result.database === "ok" &&
    result.redis === "ok" &&
    result.thingsboard === "ok";
  res.status(allOk ? 200 : 503).json(result);

  try {
    await tbRequest("/api/tenant/devices?pageSize=1&page=0");
    result.thingsboard = "ok";
  } catch (err) {
    result.thingsboard = `error: ${err.message}`;
  }
}

module.exports = { healthCheck };
