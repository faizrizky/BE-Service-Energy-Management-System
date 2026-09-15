const { config } = require("../../config/config");
const logger = require("../helpers/logger");
const { httpError } = require("../helpers/httpError");
const {
  getCsDevice,
  createCsDevice,
  updateCsDevice,
  deleteCsDevice,
  setReportInterval,
} = require("./client");

function assertDeviceProfileConfigured() {
  if (!config.chirpstack.deviceProfileId) {
    throw httpError(
      "CHIRPSTACK_DEVICE_PROFILE_ID belum diisi di environment, device tidak bisa didaftarkan ke ChirpStack",
      500,
    );
  }
}

async function csDeviceExists(devEui) {
  try {
    await getCsDevice(devEui);
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

async function ensureCsDeviceRegistered(
  devEui,
  { name, description = "", updateIfExists = true } = {},
) {
  assertDeviceProfileConfigured();

  if (await csDeviceExists(devEui)) {
    if (!updateIfExists) {
      logger.info(`[DeviceSync] ${devEui} sudah terdaftar di ChirpStack`);
      return { created: false, updated: false };
    }
    await updateCsDevice(devEui, { name, description });
    return { created: false, updated: true };
  }

  await createCsDevice({ devEui, name, description, isDisabled: false });
  return { created: true, updated: false };
}

async function removeCsDevice(devEui, { ignoreMissing = true } = {}) {
  try {
    await deleteCsDevice(devEui);
    return { deleted: true, reason: null };
  } catch (err) {
    if (ignoreMissing && err.status === 404) {
      logger.warn(`[DeviceSync] ${devEui} sudah tidak ada di ChirpStack`);
      return { deleted: false, reason: "not_found" };
    }
    throw err;
  }
}

async function rollbackCsDevice(devEui, reason = "operasi gagal") {
  try {
    await deleteCsDevice(devEui);
    logger.warn(
      `[DeviceSync] ${reason}, registrasi ChirpStack ${devEui} di-rollback`,
    );
    return true;
  } catch (err) {
    logger.error(
      `[DeviceSync] Rollback ChirpStack ${devEui} gagal, hapus manual: ${err.message}`,
    );
    return false;
  }
}

async function pushReportInterval(devEui, intervalMinutes) {
  try {
    await setReportInterval(devEui, Number(intervalMinutes) * 60);
    return { delivered: true, notes: null };
  } catch (err) {
    logger.warn(
      `[DeviceSync] Gagal kirim interval ke ${devEui}: ${err.message}`,
    );
    return { delivered: false, notes: err.message };
  }
}

module.exports = {
  assertDeviceProfileConfigured,
  csDeviceExists,
  ensureCsDeviceRegistered,
  removeCsDevice,
  rollbackCsDevice,
  pushReportInterval,
};
