const { prisma } = require("../../../frameworks/database/prismaClient");
const { httpError } = require("../../../frameworks/helpers/httpError");

async function findNotification(page = 1, rowsPerPage = 10, search, orderBy) {
    const skip = (page - 1) * rowsPerPage;

    const orderByQuery = orderBy ? { createdAt: orderBy } : { createdAt: "desc"};

    const where = search ? {
        eventType: {
          contains: search,
          mode: "insensitive",
        },
      } : {};

    const [data, totalRow] = await Promise.all([
        prisma.notification.findMany({
            where,
            skip,
            take: rowsPerPage,
            orderBy: orderByQuery
        }),
        prisma.notification.count(),
    ]) 

    const totalPage = Math.ceil(totalRow / rowsPerPage);

    return {data, page, rowsPerPage, totalRow, totalPage};
}

module.exports = {
    findNotification
}