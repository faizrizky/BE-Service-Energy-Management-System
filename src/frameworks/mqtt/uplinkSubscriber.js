const mqtt = require("mqtt");
const { config } = require("../../config/config");
const logger = require("../helpers/logger");
const deviceUseCase = require("../../application/use_cases/device/device.usecase");

const warnedUnknownEuis = new Set();

/**
 * Topic uplink aplikasi EMS aja, bukan semua aplikasi di ChirpStack.
 *
 * Dipake di: startUplinkSubscriber (file ini).
 */
function uplinkTopic() {
  return `application/${config.chirpstack.applicationId}/device/+/event/up`;
}

/**
 * Topic txack aplikasi EMS: gateway udah mancarin downlink ke device.
 *
 * Dipake di: startUplinkSubscriber (file ini).
 */
function txackTopic() {
  return `application/${config.chirpstack.applicationId}/device/+/event/txack`;
}

/**
 * Proses satu pesan MQTT: parse JSON, terus arahin ke ingestTxAck (topic
 * .../event/txack) atau ingestUplink (.../event/up). Error per pesan cuma
 * dicatet, nggak bikin subscriber berhenti.
 *
 * Dipake di: startUplinkSubscriber (file ini).
 */
async function handleMessage(topic, payload) {
  let event;
  try {
    event = JSON.parse(payload.toString());
  } catch (err) {
    logger.warn(`[MQTT] Payload bukan JSON di ${topic}, dilewati`);
    return;
  }

  try {
    if (topic.endsWith("/event/txack")) {
      await deviceUseCase.ingestTxAck(event);
      return;
    }

    const updated = await deviceUseCase.ingestUplink(event);
    const devEui = event?.deviceInfo?.devEui;
    if (!updated && devEui && !warnedUnknownEuis.has(devEui)) {
      warnedUnknownEuis.add(devEui);
      logger.warn(
        `[MQTT] Uplink dari devEUI ${devEui} belum terdaftar di EMS, dilewati`,
      );
    }
  } catch (err) {
    logger.warn(`[MQTT] Gagal proses pesan ${topic}: ${err.message}`);
  }
}

/**
 * Nyambung ke broker MQTT ChirpStack dan dengerin uplink semua device EMS.
 * Subscribe diulang tiap (re)connect, jadi aman kalau broker sempat putus.
 *
 * Dipake di: app.js → bootstrap (kalau MQTT_ENABLED=true).
 */
function startUplinkSubscriber() {
  const client = mqtt.connect(config.mqtt.url, {
    username: config.mqtt.username,
    password: config.mqtt.password,
    clientId: config.mqtt.clientId,
    reconnectPeriod: 5000,
  });

  const topics = [uplinkTopic(), txackTopic()];

  client.on("connect", () => {
    logger.info("[MQTT] Tersambung ke broker");
    client.subscribe(topics, { qos: 0 }, (err) => {
      if (err) logger.error("[MQTT] Gagal subscribe:", err.message);
      else logger.info(`[MQTT] Subscribe ke ${topics.join(", ")}`);
    });
  });
  client.on("message", (t, payload) => {
    handleMessage(t, payload);
  });
  client.on("reconnect", () => {
    logger.warn("[MQTT] Menyambung ulang ke broker...");
  });
  client.on("error", (err) => {
    logger.error("[MQTT] Error:", err.message);
  });
  return client;
}

module.exports = {
  startUplinkSubscriber,
  handleMessage,
  uplinkTopic,
  txackTopic,
};
