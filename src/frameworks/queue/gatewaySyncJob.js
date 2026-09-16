const logger = require("../helpers/logger");
const {
  syncGatewaysFromChirpstack,
} = require("../../application/use_cases/gateway/gateway.usecase");
const {
  syncDevicesFromChirpstack,
} = require("../../application/use_cases/device/device.usecase");

const TICK_MS = 60 * 1000;

let isRunning = false;

/**
 * Satu putaran sinkronisasi gateway: ambil status dari ChirpStack terus simpen
 * ke EMS. Kalo putaran sebelumnya belom kelar, putaran ini di-skip.
 *
 * Dipake di: startGatewaySync (file ini).
 */
async function runTick() {
  if (isRunning) return;

  isRunning = true;
  try {
    await syncDevicesFromChirpstack();
    await syncGatewaysFromChirpstack();
  } catch (err) {
    logger.warn(`[GatewaySync] Gagal sinkron gateway: ${err.message}`);
  } finally {
    isRunning = false;
  }
}

/**
 * Nyalain sinkronisasi gateway sekali pas start, terus tiap 1 menit.
 *
 * Dipake di: app.js → bootstrap.
 */
function startGatewaySync() {
  runTick();
  const interval = setInterval(runTick, TICK_MS);
  logger.info(
    "[GatewaySync] Sinkron device & gateway dengan ChirpStack aktif (tiap 1 menit)",
  );
  return interval;
}

module.exports = { runTick, startGatewaySync, TICK_MS };
