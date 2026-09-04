const { prisma } = require("../database/prismaClient");
const logger = require("./logger");

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
