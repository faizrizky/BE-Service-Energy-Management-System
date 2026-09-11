function parseTelemetryResponse(raw) {
  const t = raw?.telemetry ?? {};
  return {
    relayStatus:
      t.relay_state === "ON" ? "on" : t.relay_state === "OFF" ? "off" : null,
    // meter_reading didoc-kan dalam Wh -> kWh
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

module.exports = { parseTelemetryResponse, parseRelayResponse };
