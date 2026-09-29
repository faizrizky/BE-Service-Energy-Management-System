const { prisma } = require("../../../frameworks/database/prismaClient");
const { httpError } = require("../../../frameworks/helpers/httpError");
const { emitNotificationPatch } = require("../../../frameworks/webserver/socket-events");

/**
 * Edit data multiple ReadAt terus ngirim event notif:updated.
 *
 * Dipake di: notification.controller.js → patch (PATCH /api/notifications/reads).
 */
async function patchReadAtNotification(data) {
    await prisma.notification.updateMany({
        where: { 
            readAt: {
                equals: false,
            }
        },
        data: { readAt: data.readAt,},
    });

    const notification = await prisma.notification.findMany({
        orderBy: {
            updatedAt: "desc"
        }
    })

    emitNotificationPatch(notification);
    return notification;
}

module.exports = {
    patchReadAtNotification
}