const crypto = require("crypto");

const RELAY_RPC_METHOD = "setRelayState";

const ATTRIBUTE_SCOPE = {
  SERVER: "SERVER_SCOPE",
  SHARED: "SHARED_SCOPE",
  CLIENT: "CLIENT_SCOPE",
};
const DEVICE_ATTRIBUTE_KEYS = [
  "serialNumber",
  "firmwareVersion",
  "meterModel",
  "installedAt",
];

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
function buildWebhookBody({
  tbDeviceId,
  relayStatus,
  powerWatt,
  usageKwh,
  eventId,
  ts,
}) {
  return {
    tbDeviceId,
    relayStatus,
    powerWatt,
    usageKwh,
    eventId: eventId || crypto.randomUUID(),
    ts: ts || Date.now(),
  };
}

function parseWebhookBody(body) {
  const { tbDeviceId, relayStatus, powerWatt, usageKwh, eventId, ts } =
    body || {};
  return { tbDeviceId, relayStatus, powerWatt, usageKwh, eventId, ts };
}

module.exports = {
  RELAY_RPC_METHOD,
  ATTRIBUTE_SCOPE,
  DEVICE_ATTRIBUTE_KEYS,
  buildRelayRpcPayload,
  parseRelayRpcPayload,
  buildWebhookBody,
  parseWebhookBody,
};
