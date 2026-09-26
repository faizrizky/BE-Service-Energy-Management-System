const axios = require("axios");

const SERVICE_URL = process.env.SERVICE_URL || "http://localhost:4000";

async function createNotification(data) {
  const response = await axios.post(
    `${SERVICE_URL}/api/notifications`,
    {
      data: data.data,
      eventType: data.eventType,
      message: data.message,
      readAt: data.readAt ?? false,
    }
  );

  return response.data;
}

module.exports = { createNotification,};