const crypto = require("crypto");
const { prisma } = require("../../frameworks/database/prismaClient");
const { getIO } = require("../../frameworks/webserver/socket");
const { config } = require("../../config/config");
const logger = require("../../frameworks/helpers/logger");
const { TELEMETRY_KEYS } = require("../../frameworks/thingsboard/contract");

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */

function isValidSecret(headerValue) {
  const expected = config.thingsboard.webhookSecret;
  const provided = headerValue || "";

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

async function handleDeviceUpdate(req, res, next) {
  try {
    if (!isValidSecret(req.headers["x-webhook-secret"])) {
      return res.status(401).json({ message: "Webhook secret tidak valid" });
    }

    const { tbDeviceId } = req.body;
    if (!tbDeviceId || typeof tbDeviceId !== "string") {
      return res.status(400).json({ message: "Device wajib diisi" });
    }

    const relayStatus = req.body[TELEMETRY_KEYS.RELAY_STATUS];
  } catch (err) {
    next(err);
  }
}

module.exports = { handleDeviceUpdate };
