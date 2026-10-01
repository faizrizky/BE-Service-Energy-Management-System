const { prisma } = require("../../../frameworks/database/prismaClient");
const { escapeLike } = require("../../../frameworks/helpers/likeEscape");

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

    const [data, totalRow] = await Promise.all([
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