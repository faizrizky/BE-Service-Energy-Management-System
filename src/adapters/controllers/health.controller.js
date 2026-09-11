const { prisma } = require("../../frameworks/database/prismaClient");
const { getRedisClient } = require("../../frameworks/tools/redisClient");
const { listApplications } = require("../../frameworks/chirpstack/client");

const isProd = process.env.NODE_ENV === "production";

function formatError(err) {
  return isProd ? "error" : `error: ${err.message}`;
}

async function healthCheck(req, res) {
  const result = {
    app: "ok",
    database: "unknown",
    redis: "unknown",
    chirpstack: "unknown",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    result.database = "ok";
  } catch (err) {
    result.database = formatError(err);
  }

  try {
    const pong = await getRedisClient().ping();
    result.redis = pong === "PONG" ? "ok" : "unexpected response";
  } catch (err) {
    result.redis = formatError(err);
  }

  try {
    await listApplications();
    result.chirpstack = "ok";
  } catch (err) {
    result.chirpstack = formatError(err);
  }

  const allOk =
    result.database === "ok" &&
    result.redis === "ok" &&
    result.chirpstack === "ok";
  res.status(allOk ? 200 : 503).json(result);
}

module.exports = { healthCheck };
