const { prisma } = require("../../../frameworks/database/prismaClient");
const { httpError } = require("../../../frameworks/helpers/httpError");
const {
emitNotificationCreated
} = require("../../../frameworks/webserver/socket-events");
/**
 * Nyimpen notification baru (readAt default false) terus ngirim event
 * notification:created.
 *
 * Dipake di: notification.controller.js → store (POST /api/notifications).
 */
async function createNotification(data) {
  const room = await prisma.notification.create({
    data: {
      eventType: data?.eventType,
      data: data?.data,
      readAt: data?.readAt
    },
  });
  emitNotificationCreated(room);
  return room;
}

module.exports = {
    createNotification
}