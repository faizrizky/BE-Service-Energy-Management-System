const { httpError } = require("../helpers/httpError");
const DEV_EUI_PATTERN = /^[0-9a-f]{16}$/;

/**
 * Ngerapiin devEUI dari input user: undefined tetep undefined (nggak diubah),
 * null artinya dilepas, string di-trim & dikecilin terus dicek 16 hex (400
 * kalo salah).
 *
 * Dipake di: device.usecase.js → createDevice, updateDevice.
 */
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

/**
 * Bandingin dua devEUI tanpa peduli huruf besar/kecil; kalo dua-duanya kosong
 * dianggep sama.
 *
 * Dipake di: device.usecase.js → updateDevice (buat tau devEUI-nya ganti apa
 *   nggak).
 */
function sameDevEui(a, b) {
  if (!a || !b) return a === b;
  return String(a).toLocaleLowerCase() === String(b).toLocaleLowerCase();
}

/**
 * Ngecek nilai-nya devEUI 16 hex yang valid apa nggak.
 *
 * Dipake di: Belom dipake.
 */
function isDevEui(value) {
  return DEV_EUI_PATTERN.test(String(value || "").toLocaleLowerCase());
}

/**
 * Nerjemahin response telemetry middleware ke format EMS: relay_state →
 * on/off, meter_reading / 1000 → kWh, plus baterai, tegangan/arus mentah, SNR,
 * sama gateway.
 *
 * Dipake di: device.usecase.js → runTelemetryFetch.
 */
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

/**
 * Baca hasil perintah relay: udah dikonfirmasi meter apa belom, sama status
 * relai terakhirnya.
 *
 * Dipake di: device.usecase.js → attemptRelayCommand.
 */
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
