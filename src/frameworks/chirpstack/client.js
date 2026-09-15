const { config } = require("../../config/config");
const DEV_EUI_PATTERN = /^[0-9a-f]{16}$/;

/**
 * Mastiin devEUI 16 karakter hex terus diubah ke huruf kecil. Kalo nggak
 * valid, lempar 400 sebelum request dikirim.
 *
 * Dipake di: getCsDevice, createCsDevice, updateCsDevice, deleteCsDevice,
 *   pingTelemetry, setRelay, setReportInterval (file ini).
 */
function requireDevEui(devEui) {
  if (typeof devEui !== "string" || !/^[0-9a-f]{16}$/i.test(devEui)) {
    const preview = String(devEui).slice(0, 60);
    const err = new Error(`[ChirpStack] devEUI tidak valid: "${preview}"`);
    err.status = 400;
    throw err;
  }
  return devEui.toLocaleLowerCase();
}

/**
 * Pembungkus fetch ke middleware ChirpStack: pasang timeout, parse JSON, dan
 * ngubah HTTP error atau { success: false } jadi Error yang bawa status &
 * body.
 *
 * Dipake di: Semua helper endpoint di file ini.
 */
async function csRequest(path, options = {}, timeoutMs = 15000) {
  const url = `${config.chirpstack.baseUrl}${path}`;

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const wrapped = new Error(
      `[ChirpStack] Request gagal ke ${path}: ${err.message}`,
    );
    wrapped.cause = err;
    throw wrapped;
  }

  const text = await response.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      const err = new Error(
        `[ChirpStack] Gagal parse JSON dari ${path} (status ${response.status}): ${text.slice(0, 150)}`,
      );
      err.status = response.status;
      throw err;
    }
  }

  if (!response.ok || body?.success === false) {
    const err = new Error(
      `[ChirpStack] HTTP ${response.status} di ${path}: ${body?.error || body?.message || text}`,
    );
    err.status = response.status;
    err.body = body;
    throw err;
  }

  return body;
}

/**
 * List gateway di ChirpStack.
 *
 * Dipake di: Belom dipake (gateway EMS diatur di database lokal).
 */
const listGateways = ({ limit = 10, offset = 0 } = {}) =>
  csRequest(`/api/chirpstack/gateways?limit=${limit}&offset=${offset}`);

/**
 * Detail satu gateway di ChirpStack.
 *
 * Dipake di: Belom dipake.
 */
const getGateway = (gatewayId) =>
  csRequest(`/api/chirpstack/gateways/${gatewayId}`);

/**
 * Daftarin gateway baru ke ChirpStack.
 *
 * Dipake di: Belom dipake (namanya sama kayak gateway.usecase.js →
 *   createGateway, tapi nggak dipanggil dari sana).
 */
const createGateway = (payload) =>
  csRequest(`/api/chirpstack/gateways`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

/**
 * Ngedit gateway di ChirpStack.
 *
 * Dipake di: Belom dipake.
 */
const updateGateway = (gatewayId, payload) =>
  csRequest(`/api/chirpstack/gateways/${gatewayId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

/**
 * Hapus gateway di ChirpStack.
 *
 * Dipake di: Belom dipake.
 */
const deleteGateway = (gatewayId) =>
  csRequest(`/api/chirpstack/gateways/${gatewayId}`, { method: "DELETE" });

/**
 * List aplikasi ChirpStack, dipake buat ngecek koneksi ke middleware.
 *
 * Dipake di: health.controller.js → healthCheck.
 */
const listApplications = () => csRequest(`/api/chirpstack/applications`);

/**
 * List device di aplikasi ChirpStack (default CHIRPSTACK_APPLICATION_ID).
 *
 * Dipake di: device.usecase.js → listChirpstackDeviceCandidates.
 */
const listCsDevices = (applicationId = config.chirpstack.applicationId) =>
  csRequest(`/api/chirpstack/devices?applicationId=${applicationId}`);

/**
 * Detail device ChirpStack dari devEUI.
 *
 * Dipake di:
 * - devicesync.js → csDeviceExists
 * - device.usecase.js → getDeviceChirpstackMetadata.
 */
const getCsDevice = (devEui) =>
  csRequest(`/api/chirpstack/devices/${requireDevEui(devEui)}`);

/**
 * Daftarin device ke ChirpStack pake applicationId & deviceProfileId dari
 * config.
 *
 * Dipake di: devicesync.js → ensureCsDeviceRegistered.
 */
const createCsDevice = (payload) =>
  csRequest(`/api/chirpstack/devices`, {
    method: "POST",
    body: JSON.stringify({
      applicationId: config.chirpstack.applicationId,
      deviceProfileId: config.chirpstack.deviceProfileId,
      ...payload,
      devEui: requireDevEui(payload.devEui),
    }),
  });

/**
 * Ngedit nama/deskripsi device di ChirpStack.
 *
 * Dipake di: devicesync.js → ensureCsDeviceRegistered.
 */
const updateCsDevice = (devEui, payload) =>
  csRequest(`/api/chirpstack/devices/${requireDevEui(devEui)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

/**
 * Hapus device dari ChirpStack.
 *
 * Dipake di: devicesync.js → removeCsDevice, rollbackCsDevice.
 */
const deleteCsDevice = (devEui) =>
  csRequest(`/api/chirpstack/devices/${requireDevEui(devEui)}`, {
    method: "DELETE",
  });

/**
 * Minta telemetry dari meter terus nungguin uplink sampe timeout (default 120
 * detik).
 *
 * Dipake di: device.usecase.js → runTelemetryFetch.
 */
const pingTelemetry = (devEUI, { timeout = 120000 } = {}) =>
  csRequest(
    `/api/telemetry`,
    {
      method: "POST",
      body: JSON.stringify({
        devEUI: requireDevEui(devEUI),
        applicationId: config.chirpstack.applicationId,
        timeout,
      }),
    },
    timeout + 5000,
  );

/**
 * Bangunin meter terus kirim perintah relay ON (1) / OFF (0), nungguin
 * konfirmasi sesuai wakeTimeout & relayTimeout.
 *
 * Dipake di: device.usecase.js → attemptRelayCommand.
 */
const setRelay = (
  devEUI,
  turnOn,
  { wakeTimeout = 60000, relayTimeout = 30000 } = {},
) =>
  csRequest(
    `/api/relay/wake`,
    {
      method: "POST",
      body: JSON.stringify({
        devEUI: requireDevEui(devEUI),
        applicationId: config.chirpstack.applicationId,
        relay: turnOn ? 1 : 0,
        wakeTimeout,
        relayTimeout,
      }),
    },
    wakeTimeout + relayTimeout + 5000,
  );

/**
 * Kirim interval laporan meter (detik) lewat downlink.
 *
 * Dipake di:
 * - devicesync.js → pushReportInterval
 * - device.usecase.js → setDeviceInterval.
 */
const setReportInterval = (devEUI, intervalSeconds) =>
  csRequest(`/api/interval`, {
    method: "POST",
    body: JSON.stringify({
      devEUI: requireDevEui(devEUI),
      applicationId: config.chirpstack.applicationId,
      interval: intervalSeconds,
    }),
  });

module.exports = {
  csRequest,
  listGateways,
  getGateway,
  createGateway,
  updateGateway,
  deleteGateway,
  listApplications,
  listCsDevices,
  getCsDevice,
  createCsDevice,
  updateCsDevice,
  deleteCsDevice,
  pingTelemetry,
  setRelay,
  setReportInterval,
};
