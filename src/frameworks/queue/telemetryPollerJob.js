const logger = require("../helpers/logger");
const { prisma } = require("../database/prismaClient");
const {
  fetchAndStoreTelemetry,
  isDeviceBusy,
} = require("../../application/use_cases/device/device.usecase");

const TICK_MS = 60 * 1000;
const PING_TIMEOUT_MS = 120000;

/**
 * Device perlu di-poll kalo belom pernah keliatan atau lastSeenAt-nya udah
 * lewat intervalMinutes.
 *
 * Dipake di: runTick (file ini).
 */
function isDue(device, now) {
  if (!device.lastSeenAt) return true;
  const dueAt =
    device.lastSeenAt.getTime() + device.intervalMinutes * 60 * 1000;
  return now.getTime() >= dueAt;
}

/**
 * Ngambil & nyimpen telemetry satu device. Kalo error cuma dicatet sebagai
 * warning.
 *
 * Dipake di: runTick (file ini).
 */
async function pollDevice(device) {
  try {
    await fetchAndStoreTelemetry(device, { timeout: PING_TIMEOUT_MS });
  } catch (err) {
    logger.warn(
      `[TelemetryPoller] Gagal poll "${device.name}" (${device.eui}): ${err.message}`,
    );
  }
}

let isRunning = false;

/**
 * Satu putaran poller: ambil device yang punya devEUI, pilih yang udah
 * waktunya & nggak lagi sibuk, terus poll barengan. Kalo putaran sebelumnya
 * belom kelar, putaran ini di-skip.
 *
 * Dipake di: startTelemetryPoller (pas start & tiap 1 menit).
 */
async function runTick() {
  if (isRunning) {
    logger.warn("[TelemetryPoller] Tick sebelumnya masih jalan, skip tick ini");
    return;
  }

  isRunning = true;
  try {
    const now = new Date();
    const devices = await prisma.device.findMany({
      where: { eui: { not: "" } },
    });

    const due = devices.filter((d) => isDue(d, now) && !isDeviceBusy(d.id));

    await Promise.all(due.map((device) => pollDevice(device)));
  } finally {
    isRunning = false;
  }
}

/**
 * Nyalain poller telemetry sekali pas start, terus tiap 1 menit.
 *
 * Dipake di: app.js → bootstrap.
 */
function startTelemetryPoller() {
  runTick();
  const interval = setInterval(runTick, TICK_MS);
  logger.info(
    "[TelemetryPoller] Polling aktif (tick tiap 1 menit, per-device sesuai intervalMinutes)",
  );
  return interval;
}

module.exports = { startTelemetryPoller, runTick };
