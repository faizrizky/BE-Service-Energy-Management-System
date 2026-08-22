/**
 * Delete soon, sudah tidak terpakai
 */

const { getClient } = require("./client");
const logger = require("../helpers/logger");

function publishDeviceCommand(gatewayEui, deviceEui, action) {
  const client = getClient();
  const topic = `ems/gateway/${gatewayEui}/device/${deviceEui}/command`;
  const payload = JSON.stringify({
    action,
    timestamp: new Date().toDateString(),
  });

  return new Promise((resolve, reject) => {
    client.publish(topic, payload, { qos: 1 }, (err) => {
      if (err) {
        logger.error("[MQTT] Gagal publish command:", err.message);
      } else {
        logger.info(`[MQTT] Command "${action}" terkirim ke ${topic}`);
        resolve();
      }
    });
  });
}

module.exports = { publishDeviceCommand };
