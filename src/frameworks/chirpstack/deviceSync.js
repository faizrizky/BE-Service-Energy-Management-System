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

/**
 * Lempar 500 kalo CHIRPSTACK_DEVICE_PROFILE_ID belom diisi, soalnya device
 * nggak bisa didaftarin tanpa itu.
 *
 * Dipake di: ensureCsDeviceRegistered (file ini).
 */
function assertDeviceProfileConfigured() {
  if (!config.chirpstack.deviceProfileId) {
    throw httpError(
      "CHIRPSTACK_DEVICE_PROFILE_ID belum diisi di environment, device tidak bisa didaftarkan ke ChirpStack",
      500,
    );
  }
}

/**
 * Ngecek device udah ada di ChirpStack: true kalo ada, false kalo 404, error
 * lain dilempar.
 *
 * Dipake di: ensureCsDeviceRegistered (file ini).
 */
async function csDeviceExists(devEui) {
  try {
    await getCsDevice(devEui);
    return true;
  } catch (err) {
    if (err.status === 404) return false;
    throw err;
  }
}

/**
 * Mastiin device udah terdaftar di ChirpStack: bikin baru kalo belom ada,
 * update nama/deskripsi kalo udah ada (kecuali updateIfExists false).
 *
 * Dipake di: device.usecase.js → createDevice, updateDevice.
 */
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

/**
 * Hapus device dari ChirpStack. Kalo device-nya emang udah nggak ada (404),
 * di-skip aja secara default.
 *
 * Dipake di: device.usecase.js → deleteDevice.
 */
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

/**
 * Batalin pendaftaran device di ChirpStack kalo proses lain gagal. Balikin
 * false & nulis log minta dihapus manual kalo rollback-nya juga gagal.
 *
 * Dipake di: Di-import di device.usecase.js tapi belom dipanggil.
 */
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

/**
 * Kirim interval laporan (menit → detik) ke meter tanpa ngelempar error.
 * Hasilnya { delivered, notes }.
 *
 * Dipake di: device.usecase.js → createDevice, updateDevice.
 */
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
