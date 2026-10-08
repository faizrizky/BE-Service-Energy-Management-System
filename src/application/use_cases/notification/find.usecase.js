const { prisma } = require("../../../frameworks/database/prismaClient");
const { escapeLike } = require("../../../frameworks/helpers/likeEscape");
const { config } = require("../../../config/config")

async function findNotification(
    page = 1,
    rowsPerPage = 10,
    search,
    orderBy,
    readAt
) {
    search = escapeLike(search);
    const skip = (page - 1) * rowsPerPage;

    const where = {
        ...(search && {
            eventType: {
                contains: search,
                mode: "insensitive",
            },
        }),

        ...(readAt !== undefined && {
            readAt,
        }),
    };

    const orderByQuery = {
        createdAt: orderBy ?? "desc",
    };

    const [collection, totalRow] = await Promise.all([
        prisma.notification.findMany({
            where,
            skip,
            take: rowsPerPage,
            orderBy: orderByQuery,
        }),

        prisma.notification.count({
            where,
        }),
    ]);

    const formatJakarta = (date) => new Intl.DateTimeFormat('sv-SE', {
            timeZone: config.notification.timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
        }).format(date).replace(' ', 'T') + '+07:00';

    const data = collection.map((item) => ({
        ...item,
        createdAt: formatJakarta(item.createdAt),
        updatedAt: formatJakarta(item.updatedAt),
    }));

    const totalPage = Math.ceil(totalRow / rowsPerPage);

    return {
        data,
        page,
        rowsPerPage,
        totalRow,
        totalPage,
    };
}

module.exports = {
    findNotification,
};