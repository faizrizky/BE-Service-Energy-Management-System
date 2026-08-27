const { config } = require("../../config/config");
const logger = require("../helpers/logger");
const {
  RELAY_RPC_METHOD,
  buildRelayRpcPayload,
  ATTRIBUTE_SCOPE,
  DEVICE_ATTRIBUTE_KEYS,
} = require("./contract");

async function tbRequest(path, options = {}, timeoutMs = 10_000) {
  const url = `${config.thingsboard.baseUrl}${path}`;

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Authorization": `ApiKey ${config.thingsboard.apiKey}`,
        ...options.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const wrapped = new Error(
      `[ThingsBoard] Request gagal ke ${path}: ${err.message}`,
    );
    wrapped.cause = err;
    throw wrapped;
  }

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const err = new Error(
      `[ThingsBoard] HTTP ${response.status} di ${path}: ${text}`,
    );
    err.status = response.status;
    throw err;
  }

  return body;
}

/**
 * Dipakai buat kontrol relay on/off.
 *
 * @param {string} tbDeviceId - UUID device di ThingsBoard
 * @param {'on'|'off'} action
 */
async function sendRelayCommand(tbDeviceId, action) {
  const payload = {
    method: RELAY_RPC_METHOD,
    params: buildRelayRpcPayload(action).params,
    timeout: 5000,
  };
  logger.info(
    `[ThingsBoard] Kirim RPC oneway ke device ${tbDeviceId}: ${JSON.stringify(payload)}`,
  );
  return tbRequest(`/api/rpc/oneway/${tbDeviceId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * RPC two-way - TB menunggu device benar-benar merespons dalam `timeoutMs`.
 */
async function sendRelayCommandConfirmed(tbDeviceId, action, timeoutMs = 5000) {
  const payload = {
    method: RELAY_RPC_METHOD,
    params: buildRelayRpcPayload(action).params,
    timeout: timeoutMs,
  };
  return tbRequest(`/api/rpc/twoway/${tbDeviceId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

async function getDeviceAttributes(tbDeviceId, scope = ATTRIBUTE_SCOPE.SERVER) {
  const keysParam = encodeURIComponent(DEVICE_ATTRIBUTE_KEYS.join(","));
  return tbRequest(
    `/api/plugins/telemetry/DEVICE/${tbDeviceId}/values/attributes/${scope}?keys=${keysParam}`,
  );
}

async function setDeviceAttributes(
  tbDeviceId,
  attributes,
  scope = ATTRIBUTE_SCOPE.SERVER,
) {
  return tbRequest(`/api/plugins/telemetry/DEVICE/${tbDeviceId}/${scope}`, {
    method: "POST",
    body: JSON.stringify(attributes),
  });
}

async function getTelemetryHistory(
  tbDeviceId,
  keys,
  startTs,
  endTs,
  limit = 1000,
) {
  const keysParam = encodeURIComponent(keys.join(","));
  return tbRequest(
    `/api/plugins/telemetry/DEVICE/${tbDeviceId}/values/timeseries` +
      `?keys=${keysParam}&startTs=${startTs}&endTs=${endTs}&limit=${limit}&useStrictDataTypes=true`,
  );
}

/**
 * Dipakai buat validasi mapping tbDeviceId di form Device (bukan buat
 * nge-mirror seluruh device TB ke Postgres).
 */
async function listTbDevices({ page = 0, pageSize = 50 } = {}) {
  return tbRequest(
    `/api/tenant/devices?pageSize=${pageSize}&page=${page}&sortProperty=name&sortOrder=ASC`,
  );
}

async function getActiveAlarms({ pageSize = 20, page = 0 } = {}) {
  return tbRequest(
    `/api/alarms?pageSize=${pageSize}&page=${page}&sortProperty=createdTime&sortOrder=DESC&statusList=ACTIVE_UNACK,ACTIVE_ACK`,
  );
}

async function ackAlarm(alarmId) {
  return tbRequest(`/api/alarm/${alarmId}/ack`, { method: "POST" });
}

async function clearAlarm(alarmId) {
  return tbRequest(`/api/alarm/${alarmId}/clear`, { method: "POST" });
}

/**
 * Ambil nilai telemetry terbaru untuk satu device.
 * @param {string} tbDeviceId
 * @param {string[]} keys
 */
async function getLatestTelemetry(tbDeviceId, keys) {
  const keysParam = encodeURIComponent(keys.join(","));
  return tbRequest(
    `/api/plugins/telemetry/DEVICE/${tbDeviceId}/values/timeseries?keys=${keysParam}&useStrictDataTypes=true`,
  );
}

module.exports = {
  tbRequest,
  sendRelayCommand,
  sendRelayCommandConfirmed,
  getLatestTelemetry,
  getDeviceAttributes,
  setDeviceAttributes,
  getTelemetryHistory,
  listTbDevices,
  getActiveAlarms,
  ackAlarm,
  clearAlarm,
};
