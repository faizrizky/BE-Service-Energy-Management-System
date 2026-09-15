const { httpError } = require("../helpers/httpError");
const DEV_EUI_PATTERN = /^[0-9a-f]{16}$/;

function normalizeDevEui(value) {
  if (value === undefined) return undefined;
  if (value === null || "") return null;

  if (typeof value !== "string") {
    throw httpError(
      `devEUI harus berupa string, diterima tipe "${typeof value}"`,
      400,
    );
  }

  const devEui = value.trim().toLocaleLowerCase();

  if (!DEV_EUI_PATTERN.test(devEui)) {
    throw httpError(
      `devEUI tidak valid: "${devEui}" (harus 16 karakter heksadesimal)`,
      400,
    );
  }
  return devEui;
}

function sameDevEui(a, b) {
  if (!a || !b) return a === b;
  return String(a).toLocaleLowerCase() === String(b).toLocaleLowerCase();
}

function isDevEui(value) {
  return DEV_EUI_PATTERN.test(String(value || "").toLocaleLowerCase());
}

function parseTelemetryResponse(raw) {
  const t = raw?.telemetry ?? {};
  return {
    relayStatus:
      t.relay_state === "ON" ? "on" : t.relay_state === "OFF" ? "off" : null,
    usageKwh:
      typeof t.meter_reading === "number" ? t.meter_reading / 1000 : null,
    powerWatt: null, // TODO: isi setelah skala voltage*current
    battery: t.battery ?? null,
    voltageRaw: t.voltage ?? null,
    currentRaw: t.current ?? null,
    snr: raw?.snr ?? null,
    gatewayId: raw?.gatewayId ?? null,
    ts: raw?.time ? new Date(raw.time).getTime() : Date.now(),
  };
}

function parseRelayResponse(raw) {
  return {
    confirmed: Boolean(raw?.data?.stateConfirmed),
    relayState: raw?.data?.relayState === "ON" ? "on" : "off",
  };
}

module.exports = {
  DEV_EUI_PATTERN,
  normalizeDevEui,
  sameDevEui,
  isDevEui,
  parseTelemetryResponse,
  parseRelayResponse,
};
