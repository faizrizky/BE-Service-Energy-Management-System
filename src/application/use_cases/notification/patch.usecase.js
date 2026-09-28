const { prisma } = require("../../../frameworks/database/prismaClient");
const { httpError } = require("../../../frameworks/helpers/httpError");
const { emitNotificationPatch } = require("../../../frameworks/webserver/socket-events");

/**
 * Edit data satuan ReadAt terus ngirim event notif:updated.
 *
 * Dipake di: notification.controller.js → patch (PATCH /api/notifications/:id).
 */
async function patchReadAtNotification(id, data) {
  const notification = await prisma.notification.update({
    where: { id },
    data: {
      readAt: data.readAt,
    },
  });
  emitNotificationPatch(notification);
  return notification;
}

module.exports = {
    patchReadAtNotification
}