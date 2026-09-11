const { config } = require("../../config/config");

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

const listGateways = ({ limit = 10, offset = 0 } = {}) =>
  csRequest(`/api/chirpstack/gateways?limit=${limit}&offset=${offset}`);

const getGateway = (gatewayId) =>
  csRequest(`/api/chirpstack/gateways/${gatewayId}`);

const createGateway = (payload) =>
  csRequest(`/api/chirpstack/gateways`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

const updateGateway = (gatewayId, payload) =>
  csRequest(`/api/chirpstack/gateways/${gatewayId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

const deleteGateway = (gatewayId) =>
  csRequest(`/api/chirpstack/gateways/${gatewayId}`, { method: "DELETE" });

const listApplications = () => csRequest(`/api/chirpstack/applications`);

const listCsDevices = (applicationId = config.chirpstack.applicationId) =>
  csRequest(`/api/chirpstack/devices?applicationId=${applicationId}`);

const getCsDevice = (devEui) => csRequest(`/api/chirpstack/devices/${devEui}`);

const createCsDevice = (payload) =>
  csRequest(`/api/chirpstack/devices`, {
    method: "POST",
    body: JSON.stringify({
      applicationId: config.chirpstack.applicationId,
      deviceProfileId: config.chirpstack.deviceProfileId,
      ...payload,
    }),
  });

const updateCsDevice = (devEui, payload) =>
  csRequest(`/api/chirpstack/devices/${devEui}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

const deleteCsDevice = (devEui) =>
  csRequest(`/api/chirpstack/devices/${devEui}`, { method: "DELETE" });

const pingTelemetry = (devEUI, { timeout = 120000 } = {}) =>
  csRequest(
    `/api/telemetry`,
    {
      method: "POST",
      body: JSON.stringify({
        devEUI,
        applicationId: config.chirpstack.applicationId,
        timeout,
      }),
    },
    timeout + 5000,
  );

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
        devEUI,
        applicationId: config.chirpstack.applicationId,
        relay: turnOn ? 1 : 0,
        wakeTimeout,
        relayTimeout,
      }),
    },
    wakeTimeout + relayTimeout + 5000,
  );

const topup = (devEUI, amount, { fPort = 112 } = {}) =>
  csRequest(`/api/topup`, {
    method: "POST",
    body: JSON.stringify({
      devEUI,
      applicationId: config.chirpstack.applicationId,
      topup: amount,
      fPort,
    }),
  });

const setReportInterval = (devEUI, intervalSeconds) =>
  csRequest(`/api/interval`, {
    method: "POST",
    body: JSON.stringify({
      devEUI,
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
  topup,
  setReportInterval,
};
