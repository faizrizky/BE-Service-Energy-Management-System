const crypto = require("crypto");
const { prisma } = require("../../frameworks/database/prismaClient");
const { getIO } = require("../../frameworks/webserver/socket");
const { config } = require("../../config/config");
const logger = require("../../frameworks/helpers/logger");
const { parseWebhookBody } = require("../../frameworks/thingsboard/contract");

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

    const { tbDeviceId, relayStatus, powerWatt, usageKwh } = parseWebhookBody(
      req.body,
    );

    if (!tbDeviceId || typeof tbDeviceId !== "string") {
      return res.status(400).json({ message: "tbDeviceId wajib diisi" });
    }

    const device = await prisma.device.findUnique({ where: { tbDeviceId } });
    if (!device) {
      logger.warn(
        `[ThingsBoard Webhook] Device dengan tbDeviceId "${tbDeviceId}" tidak ditemukan di backend`,
      );
      return res.status(404).json({ message: "Device tidak ditemukan" });
    }

    let updatedDevice = device;
    if (relayStatus === "on" || relayStatus === "off") {
      updatedDevice = await prisma.device.update({
        where: { id: device.id },
        data: { status: relayStatus },
      });
    }

    if (powerWatt !== undefined || usageKwh !== undefined) {
      await prisma.energyReading.create({
        data: {
          deviceId: device.id,
          powerWatt: powerWatt ?? null,
          usageKwh: usageKwh ?? null,
        },
      });
    }

    try {
      getIO().emit("device:status", {
        deviceId: updatedDevice.id,
        eui: updatedDevice.eui,
        roomId: updatedDevice.roomId,
        status: updatedDevice.status,
        powerWatt,
        usageKwh,
        timestamp: new Date().toISOString(),
      });
    } catch (ioErr) {
      logger.warn("[ThingsBoard Webhook] Gagal emit socket:", ioErr.message);
    }

    res.status(200).json({ message: "OK" });
  } catch (err) {
    next(err);
  }
}

module.exports = { handleDeviceUpdate };
