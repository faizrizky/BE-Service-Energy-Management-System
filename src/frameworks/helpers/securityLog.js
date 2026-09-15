const { prisma } = require("../database/prismaClient");
const logger = require("./logger");

/**
 * Nyatet kejadian keamanan (login gagal/dikunci, refresh token, akses ditolak,
 * captcha gagal) plus IP & user-agent. Kalo gagal nulis log, request-nya tetep
 * jalan.
 *
 * Dipake di:
 * - login.usecase.js → login
 * - refreshToken.usecase.js → refreshAccessToken
 * - rbacMiddleware.js → checkPermission
 * - middlewares/requireCaptcha.js → requireCaptcha.
 */
async function logSecurityEvent({ type, username, userId, req, detail }) {
  try {
    await prisma.securityEvent.create({
      data: {
        type,
        username: username || null,
        userId: userId || null,
        ip: req?.ip || null,
        userAgent: req?.headers?.["user-agent"] || null,
        detail: detail || null,
      },
    });
  } catch (err) {
    logger.error("[SecurityLog] Gagal mencatat event:", err.message);
  }
}

module.exports = { logSecurityEvent };
