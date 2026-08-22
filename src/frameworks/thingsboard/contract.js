const RELAY_RPC_METHOD = "setRelayState";

/**
 * Payload RPC one-way buat kontrol relay.
 * @param {'on'|'off'} action
 */
function buildRelayRpcPayload(action) {
  return {
    method: RELAY_RPC_METHOD,
    params: { state: action === "on" },
    timeout: 5000,
  };
}

/**
 * Untuk  mock server buat interpretasi RPC yang masuk, meniru cara device asli membaca command.
 * @returns {'on'|'off'|null} null kalau method tidak dikenali
 */
function parseRelayRpcPayload(body) {
  if (!body || body.method !== RELAY_RPC_METHOD) return null;
  return body.params?.state ? "on" : "off";
}

/**
 * Bentuk body webhook yang dikirim ThingsBoard ke endpoint
 */
function buildWebhookBody({ tbDeviceId, relayStatus, powerWatt, usageKwh }) {
  return { tbDeviceId, relayStatus, powerWatt, usageKwh };
}

function parseWebhookBody(body) {
  const { tbDeviceId, relayStatus, powerWatt, usageKwh } = body || {};
  return { tbDeviceId, relayStatus, powerWatt, usageKwh };
}

module.exports = {
  RELAY_RPC_METHOD,
  buildRelayRpcPayload,
  parseRelayRpcPayload,
  buildWebhookBody,
  parseWebhookBody,
};
