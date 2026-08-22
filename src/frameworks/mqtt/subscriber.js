/**
 * Delete soon, sudah tidak terpakai
 */

const { getClient } = require("./client");
const { prisma } = require("../database/prismaClient");
const { getIO } = require("../webserver/socket");
const logger = require("../helpers/logger");

function subscribeDeviceStatus() {
  const client = getClient();
  const statusTopic = "ems/gateway/+/device/+/status";

  client.subscribe(statusTopic, (err) => {
    if (err) logger.error("[MQTT] Gagal subscribe:", err.message);
    else logger.info(`[MQTT] Subscribed ke ${statusTopic}`);
  });

  client.on("message", async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      const deviceEui = topic.split("/")[4];

      const device = await prisma.device.update({
        where: { eui: deviceEui },
        data: { status: payload.status },
      });

      logger.info(
        `[MQTT] Status device ${deviceEui} diupdate ke ${payload.status}`,
      );

      try {
        getIO().emit("device:status", {
          deviceId: device.id,
          eui: device.eui,
          roomId: device.roomId,
          status: device.status,
          timestamp: new Date().toISOString(),
        });
      } catch (ioErr) {}
    } catch (err) {
      logger.error("[MQTT] Gagal proses message:", err.message);
    }
  });
}

module.exports = { subscribeDeviceStatus };
