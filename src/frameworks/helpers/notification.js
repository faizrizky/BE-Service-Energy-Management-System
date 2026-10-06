const logger = require("./logger");
const {
  createNotification: saveNotification,
} = require("../../application/use_cases/notification/create.usecase");

async function createNotification({ data, eventType, message }) {
  try {
    return await saveNotification({ data, eventType, message, readAt: false });
  } catch (err) {
    logger.error("[Notification] Gagal bikin notifikasi:", err.message);
    return null;
  }
}

module.exports = { createNotification };
