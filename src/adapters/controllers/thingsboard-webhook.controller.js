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

    if (!tbDeviceId) {
      return res.status(400).json({ message: "tbDeviceId wajib diisi" });
    }

    const device = await prisma.device.findUnique({ where: { tbDeviceId } });
    if (!device) {
      logger.warn(
        `[Webhook] tbDeviceId "${tbDeviceId}" tidak dikenal, event diabaikan`,
      );
      return res.status(200).json({ ignored: true });
    }

    // Terima event apa pun dari device ini = device masih hidup, catat waktunya.
    // Ini yang jadi dasar perhitungan online/offline, terpisah dari status relay.
    await prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        ...(relayStatus && relayStatus !== device.status
          ? { status: relayStatus }
          : {}),
      },
    });

    if (typeof powerWatt === "number" || typeof usageKwh === "number") {
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
        deviceId: device.id,
        eui: device.eui,
        roomId: device.roomId,
        status: relayStatus || device.status,
        powerWatt,
        usageKwh,
        timestamp: new Date().toISOString(),
      });
    } catch (ioErr) {}

    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { handleDeviceUpdate };
