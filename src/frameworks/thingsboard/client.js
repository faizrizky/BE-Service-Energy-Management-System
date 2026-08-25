const { config } = require("../../config/config");
const logger = require("../helpers/logger");
const { RELAY_RPC_METHOD, buildRelayRpcPayload } = require("./contract");

async function tbRequest(path, options = {}) {
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
      signal: AbortSignal.timeout(10_000),
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
    params: buildRelayRpcPayload(action),
    timeout: 5000,
  };

  logger.info(
    `[ThingsBoard] Kirim RPC ke device ${tbDeviceId}: ${JSON.stringify(payload)}`,
  );

  return tbRequest(`/api/rpc/oneway/${tbDeviceId}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
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

module.exports = { tbRequest, sendRelayCommand, getLatestTelemetry };
