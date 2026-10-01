const { getRedisClient } = require("../tools/redisClient");
const { config } = require("../../config/config");

const key = (sessionId) => `auth:revoked-session:${sessionId}`;

/**
 * Masukin sesi ke daftar cabut di Redis, jadi access token dengan sid ini
 * langsung ditolak walau belum kadaluarsa. TTL = umur refresh token (batas
 * atas umur access token), habis itu key hilang sendiri.
 *
 * Dipake di: logout.usecase.js → logout.
 */
async function revokeSession(sessionId) {
  const ttlSeconds = config.jwt.refreshExpiresDays * 24 * 60 * 60;
  await getRedisClient().set(key(sessionId), "1", "EX", ttlSeconds);
}

/**
 * true kalo sesi udah dicabut lewat logout. Token lama tanpa sid (keluaran
 * sebelum fitur ini) dianggap belum dicabut.
 *
 * Dipake di: authMiddleware.js, socket.js (io.use).
 */
async function isSessionRevoked(sessionId) {
  if (!sessionId) return false;
  return (await getRedisClient().exists(key(sessionId))) === 1;
}

module.exports = { revokeSession, isSessionRevoked };
