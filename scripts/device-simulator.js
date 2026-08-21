require('dotenv').config();
const mqtt = require('mqtt');

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';

/**
 * Daftar device virtual gatewayEui & deviceEui.
 */
const SIMULATED_DEVICES = [
  { gatewayEui: 'GW-001', deviceEui: 'DEV-001', name: 'AC Command Center' },
  // tambahkan device lain di sini
];

const deviceState = {}; // status on/off + akumulasi kWh per device

function commandTopic(gatewayEui, deviceEui) {
  return `ems/gateway/${gatewayEui}/device/${deviceEui}/command`;
}

function statusTopic(gatewayEui, deviceEui) {
  return `ems/gateway/${gatewayEui}/device/${deviceEui}/status`;
}

function readingTopic(gatewayEui, deviceEui) {
  return `ems/gateway/${gatewayEui}/device/${deviceEui}/reading`;
}

function randomWatt() {
  return Math.round((80 + Math.random() * 170) * 100) / 100;
}

const client = mqtt.connect(BROKER_URL);

client.on('connect', () => {
  console.log(`[Simulator] Terhubung ke broker: ${BROKER_URL}`);

  SIMULATED_DEVICES.forEach(({ gatewayEui, deviceEui, name }) => {
    deviceState[deviceEui] = { status: 'off', usageKwh: 0 };

    const topic = commandTopic(gatewayEui, deviceEui);
    client.subscribe(topic, (err) => {
      if (err) console.error(`[Simulator] Gagal subscribe ${topic}:`, err.message);
      else console.log(`[Simulator] "${name}" (${deviceEui}) listening di ${topic}`);
    });
  });
});

// Terima command ON/OFF dari backend
client.on('message', (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());
    const parts = topic.split('/'); // ems/gateway/{gatewayEui}/device/{deviceEui}/command
    const gatewayEui = parts[2];
    const deviceEui = parts[4];

    const device = SIMULATED_DEVICES.find((d) => d.deviceEui === deviceEui);
    if (!device) return;

    console.log(`[Simulator] Command diterima "${payload.action}" untuk ${device.name} (${deviceEui})`);

    setTimeout(() => {
      deviceState[deviceEui].status = payload.action;

      client.publish(
        statusTopic(gatewayEui, deviceEui),
        JSON.stringify({ status: payload.action, timestamp: new Date().toISOString() }),
        { qos: 1 },
      );

      console.log(`[Simulator] "${device.name}" sekarang: ${payload.action}`);
    }, 500 + Math.random() * 1000);
  } catch (err) {
    console.error('[Simulator] Gagal proses command:', err.message);
  }
});

// Publish reading energi tiap 10 detik untuk device yang lagi ON,
setInterval(() => {
  SIMULATED_DEVICES.forEach(({ gatewayEui, deviceEui, name }) => {
    const state = deviceState[deviceEui];
    if (!state || state.status !== 'on') return;

    const powerWatt = randomWatt();
    const deltaKwh = (powerWatt * (10 / 3600)) / 1000;
    state.usageKwh += deltaKwh;

    client.publish(
      readingTopic(gatewayEui, deviceEui),
      JSON.stringify({
        powerWatt,
        usageKwh: Number(state.usageKwh.toFixed(4)),
        timestamp: new Date().toISOString(),
      }),
      { qos: 0 },
    );

    console.log(`[Simulator] "${name}" reading: ${powerWatt}W (total ${state.usageKwh.toFixed(3)} kWh)`);
  });
}, 10000);

client.on('error', (err) => {
  console.error('[Simulator] Connection error:', err.message);
});

console.log('[Simulator] Jalan... tekan Ctrl+C untuk berhenti.');