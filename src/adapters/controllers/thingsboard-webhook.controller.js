// src/adapters/controllers/thingsboard-webhook.controller.js
const crypto = require("crypto");
const { prisma } = require("../../frameworks/database/prismaClient");
const {
  emitDeviceStatus,
} = require("../../frameworks/webserver/socket-events");
const { config } = require("../../config/config");
const logger = require("../../frameworks/helpers/logger");
const { parseWebhookBody } = require("../../frameworks/thingsboard/contract");

function isValidSecret(headerValue) {
  const expected = config.thingsboard.webhookSecret;
  const provided = headerValue || "";

  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);

  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

async function recordAuditEvent({
  eventId = null,
  tbDeviceId = null,
  status,
  payload,
  errorMessage = null,
}) {
  try {
    return await prisma.webhookEvent.create({
      data: {
        source: "thingsboard",
        eventId,
        tbDeviceId,
        status,
        payload,
        errorMessage,
      },
    });
  } catch (err) {
    // eventId duplikat -> P2002. Selain itu, jangan sampai kegagalan audit
    // log ngeblok pemrosesan webhook utama.
    if (err.code === "P2002") throw err;
    logger.error("[Webhook] Gagal mencatat audit event:", err.message);
    return null;
  }
}

async function handleDeviceUpdate(req, res, next) {
  try {
    if (!isValidSecret(req.headers["x-webhook-secret"])) {
      logger.warn("[Webhook] Secret tidak valid, request ditolak");
      return res.status(401).json({ message: "Webhook secret tidak valid" });
    }

    const { tbDeviceId, relayStatus, powerWatt, usageKwh, eventId } =
      parseWebhookBody(req.body);

    if (!tbDeviceId) {
      await recordAuditEvent({
        status: "error",
        payload: req.body,
        errorMessage: "tbDeviceId wajib diisi",
      });
      return res.status(400).json({ message: "tbDeviceId wajib diisi" });
    }

    let auditRecord;
    try {
      auditRecord = await recordAuditEvent({
        eventId,
        tbDeviceId,
        status: "received",
        payload: req.body,
      });
    } catch (err) {
      if (err.code === "P2002") {
        logger.warn(`[Webhook] Event duplikat diabaikan (eventId: ${eventId})`);
        return res.status(200).json({ ignored: true, reason: "duplicate" });
      }
      throw err;
    }

    const device = await prisma.device.findUnique({ where: { tbDeviceId } });
    if (!device) {
      if (auditRecord) {
        await prisma.webhookEvent.update({
          where: { id: auditRecord.id },
          data: { status: "ignored_unknown_device" },
        });
      }
      logger.warn(
        `[Webhook] tbDeviceId "${tbDeviceId}" tidak dikenal, event diabaikan`,
      );
      return res.status(200).json({ ignored: true, reason: "unknown_device" });
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

    if (auditRecord) {
      await prisma.webhookEvent.update({
        where: { id: auditRecord.id },
        data: { status: "processed" },
      });
    }

    emitDeviceStatus({
      deviceId: device.id,
      eui: device.eui,
      roomId: device.roomId,
      status: relayStatus || device.status,
      powerWatt,
      usageKwh,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({ received: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { handleDeviceUpdate };
