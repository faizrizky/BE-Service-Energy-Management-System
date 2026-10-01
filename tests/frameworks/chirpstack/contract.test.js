const {
  normalizeDevEui,
  sameDevEui,
  isDevEui,
  parseTelemetryResponse,
  parseRelayResponse,
  parseUplinkEvent,
} = require("../../../src/frameworks/chirpstack/contract");

// Dipotong dari uplink asli KwH Meter (mosquitto_sub, 2026-09-30): frame status
// tanpa data meter (has_metering_data false), relai OFF.
const REAL_STATUS_UPLINK = {
  time: "2026-09-30T04:07:38.263809+00:00",
  deviceInfo: {
    applicationId: "90b6e803-efee-4ac5-ae90-6ae7f6eee950",
    deviceName: "KwH Meter",
    devEui: "08000000410000e4",
    deviceClassEnabled: "CLASS_C",
  },
  fPort: 113,
  object: {
    relay_state: "OFF",
    relay_status: "disconnected",
    meter_reading: null,
    has_metering_data: false,
    battery: 100.0,
    voltage: null,
    current: null,
  },
  rxInfo: [{ gatewayId: "7276ff0045060ffb", snr: 11.2 }],
};

describe("parseUplinkEvent", () => {
  test("[positive] uplink asli: relai OFF, tanpa kWh, SNR & gateway dari rxInfo pertama", () => {
    expect(parseUplinkEvent(REAL_STATUS_UPLINK)).toEqual({
      relayStatus: "off",
      usageKwh: null,
      powerWatt: null,
      battery: 100,
      voltageRaw: null,
      currentRaw: null,
      snr: 11.2,
      gatewayId: "7276ff0045060ffb",
      ts: new Date("2026-09-30T04:07:38.263809+00:00").getTime(),
    });
  });

  test("[positive] frame yang bawa meter_reading -> dikonversi ke kWh sama kayak jalur ping", () => {
    const parsed = parseUplinkEvent({
      ...REAL_STATUS_UPLINK,
      object: { relay_state: "ON", meter_reading: 415782 },
    });
    expect(parsed).toMatchObject({ relayStatus: "on", usageKwh: 415.782 });
  });

  test("[negative] tanpa object & rxInfo (decoder gagal) -> semua null, nggak throw", () => {
    expect(parseUplinkEvent({ time: "2026-09-30T04:07:38Z" })).toMatchObject({
      relayStatus: null,
      usageKwh: null,
      snr: null,
      gatewayId: null,
    });
    expect(() => parseUplinkEvent(null)).not.toThrow();
  });
});

describe("normalizeDevEui", () => {
  test("[positive] trim & lowercase devEUI valid", () => {
    expect(normalizeDevEui("  08000000410000E4 ")).toBe("08000000410000e4");
  });

  test("[positive] undefined -> undefined (field tidak dikirim), null -> null (dilepas)", () => {
    expect(normalizeDevEui(undefined)).toBeUndefined();
    expect(normalizeDevEui(null)).toBeNull();
  });

  test("[negative] panjang salah / karakter non-hex -> 400", () => {
    for (const bad of ["0800", "08000000410000e4aa", "g8000000410000e4", "0800-0000-4100-00e4"]) {
      expect(() => normalizeDevEui(bad)).toThrow(expect.objectContaining({ status: 400 }));
    }
  });

  test("[negative] bukan string -> 400 menyebut tipe", () => {
    expect(() => normalizeDevEui(123)).toThrow('devEUI harus berupa string, diterima tipe "number"');
    expect(() => normalizeDevEui({})).toThrow(expect.objectContaining({ status: 400 }));
  });

  // `if (value === null || "")` -> operand kanan selalu falsy, string kosong tidak dianggap null.
  test.failing("[BUG] string kosong seharusnya diperlakukan sama dengan null", () => {
    expect(normalizeDevEui("")).toBeNull();
  });
});

describe("sameDevEui", () => {
  test("[positive] case-insensitive", () => {
    expect(sameDevEui("08000000410000E4", "08000000410000e4")).toBe(true);
  });

  test("[positive] dua-duanya kosong dianggap sama", () => {
    expect(sameDevEui(null, null)).toBe(true);
    expect(sameDevEui(undefined, undefined)).toBe(true);
  });

  test("[negative] berbeda atau salah satu kosong", () => {
    expect(sameDevEui("08000000410000e4", "08000000410000e5")).toBe(false);
    expect(sameDevEui("08000000410000e4", null)).toBe(false);
    expect(sameDevEui(null, "08000000410000e4")).toBe(false);
  });
});

describe("isDevEui", () => {
  test("[positive] 16 hex huruf besar/kecil", () => {
    expect(isDevEui("08000000410000E4")).toBe(true);
  });

  test("[negative] kosong, null, panjang salah", () => {
    expect(isDevEui("")).toBe(false);
    expect(isDevEui(null)).toBe(false);
    expect(isDevEui(undefined)).toBe(false);
    expect(isDevEui("0800")).toBe(false);
  });
});

describe("parseTelemetryResponse", () => {
  test("[positive] payload lengkap dipetakan ke satuan EMS", () => {
    const parsed = parseTelemetryResponse({
      telemetry: {
        relay_state: "ON",
        meter_reading: 205912,
        battery: 98,
        voltage: 2200,
        current: 15,
      },
      snr: 7.5,
      gatewayId: "7276ff0045060ffb",
      time: "2026-09-14T10:00:00.000Z",
    });

    expect(parsed).toEqual({
      relayStatus: "on",
      usageKwh: 205.912,
      powerWatt: null,
      battery: 98,
      voltageRaw: 2200,
      currentRaw: 15,
      snr: 7.5,
      gatewayId: "7276ff0045060ffb",
      ts: Date.parse("2026-09-14T10:00:00.000Z"),
    });
  });

  test("[positive] relay_state OFF -> 'off'", () => {
    expect(parseTelemetryResponse({ telemetry: { relay_state: "OFF" } }).relayStatus).toBe("off");
  });

  test("[negative] relay_state tidak dikenal / huruf kecil -> null (bukan salah tebak)", () => {
    expect(parseTelemetryResponse({ telemetry: { relay_state: "on" } }).relayStatus).toBeNull();
    expect(parseTelemetryResponse({ telemetry: { relay_state: "UNKNOWN" } }).relayStatus).toBeNull();
  });

  test("[negative] meter_reading bukan number -> usageKwh null", () => {
    expect(parseTelemetryResponse({ telemetry: { meter_reading: "205912" } }).usageKwh).toBeNull();
  });

  test("[positive] meter_reading 0 tetap dihitung (bukan null)", () => {
    expect(parseTelemetryResponse({ telemetry: { meter_reading: 0 } }).usageKwh).toBe(0);
  });

  test("[negative] raw kosong/undefined -> semua null, ts pakai waktu sekarang", () => {
    const now = Date.now();
    const parsed = parseTelemetryResponse(undefined);
    expect(parsed).toMatchObject({
      relayStatus: null,
      usageKwh: null,
      battery: null,
      snr: null,
      gatewayId: null,
    });
    expect(parsed.ts).toBeGreaterThanOrEqual(now);
  });
});

describe("parseRelayResponse", () => {
  test("[positive] terkonfirmasi ON", () => {
    expect(parseRelayResponse({ data: { stateConfirmed: true, relayState: "ON" } })).toEqual({
      confirmed: true,
      relayState: "on",
    });
  });

  test("[negative] tidak terkonfirmasi / payload kosong -> confirmed false, state off", () => {
    expect(parseRelayResponse({ data: { stateConfirmed: false, relayState: "OFF" } })).toEqual({
      confirmed: false,
      relayState: "off",
    });
    expect(parseRelayResponse(null)).toEqual({ confirmed: false, relayState: "off" });
  });

  test("[negative] stateConfirmed truthy non-boolean tetap dianggap true", () => {
    expect(parseRelayResponse({ data: { stateConfirmed: 1 } }).confirmed).toBe(true);
  });
});
