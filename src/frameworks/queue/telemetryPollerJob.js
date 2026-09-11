const logger = require("../helpers/logger");
const { prisma } = require("../database/prismaClient");
const { pingTelemetry } = require("../chirpstack/client");
const { parseTelemetryResponse } = require("../chirpstack/contract");
const { emitDeviceStatus } = require("../webserver/socket-events");

const TICK_MS = 60 * 1000;
const PING_TIMEOUT_MS = 120000;

function isDue(device, now) {
  if (!device.lastSeenAt) return true;
  const dueAt =
    device.lastSeenAt.getTime() + device.intervalMinutes * 60 * 1000;
  return now.getTime() >= dueAt;
}

async function pollDevice(device) {
  try {
    const raw = await pingTelemetry(device.tbDeviceId, {
      timeout: PING_TIMEOUT_MS,
    });
    const parsed = parseTelemetryResponse(raw);

    await prisma.device.update({
      where: { id: device.id },
      data: {
        lastSeenAt: new Date(),
        ...(parsed.relayStatus && parsed.relayStatus !== device.status
          ? { status: parsed.relayStatus }
          : {}),
      },
    });

    if (parsed.usageKwh !== null || parsed.powerWatt !== null) {
      await prisma.energyReading.create({
        data: {
          deviceId: device.id,
          powerWatt: parsed.powerWatt,
          usageKwh: parsed.usageKwh,
        },
      });
    }

    emitDeviceStatus({
      deviceId: device.id,
      eui: device.eui,
      roomId: device.roomId,
      status: parsed.relayStatus || device.status,
      powerWatt: parsed.powerWatt,
      usageKwh: parsed.usageKwh,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.warn(
      `[TelemetryPoller] Gagal poll "${device.name}" (${device.tbDeviceId}): ${err.message}`,
    );
  }
}

let isRunning = false;

async function runTick() {
  if (isRunning) {
    logger.warn(
      "[TelemetryPoller] Tick sebelumnya masih jalan, skip tick ini",
    );
    return;
  }

  isRunning = true;
  try {
    const now = new Date();
    const devices = await prisma.device.findMany({
      where: { tbDeviceId: { not: null } },
    });
    const due = devices.filter((d) => isDue(d, now));

    await Promise.all(due.map((device) => pollDevice(device)));
  } finally {
    isRunning = false;
  }
}

function startTelemetryPoller() {
  runTick();
  const interval = setInterval(runTick, TICK_MS);
  logger.info(
    "[TelemetryPoller] Polling aktif (tick tiap 1 menit, per-device sesuai intervalMinutes)",
  );
  return interval;
}

module.exports = { startTelemetryPoller, runTick };
