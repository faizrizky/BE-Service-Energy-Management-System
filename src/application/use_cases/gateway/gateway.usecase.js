const { prisma } = require("../../../frameworks/database/prismaClient");

async function listGatewaysPaginated({
  page = 1,
  rowsPerPage = 10,
  search,
} = {}) {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { eui: { contains: search, mode: "insensitive" } },
        ],
      }
    : undefined;

  const [totalRows, gateways] = await Promise.all([
    prisma.gateway.count({ where }),
    prisma.gateway.findMany({
      where,
      include: { installedBy: { select: { id: true, fullName: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * rowsPerPage,
      take: rowsPerPage,
    }),
  ]);

  return {
    data: gateways,
    page,
    rowsPerPage,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / rowsPerPage)),
  };
}

async function getGatewayById(id) {
  return prisma.gateway.findUnique({
    where: { id },
    include: {
      devices: true,
      installedBy: { select: { id: true, fullName: true, username: true } },
    },
  });
}

async function createGateway(data) {
  return prisma.gateway.create({
    data: {
      eui: data.eui,
      name: data.name,
      description: data.description,
      simcard: data.simcard,
      powerSource: data.powerSource,
      modelUnit: data.modelUnit,
      installationDate: data.installationDate
        ? new Date(data.installationDate)
        : undefined,
      installedById: data.installedById || null,
    },
    include: { installedBy: { select: { id: true, fullName: true } } },
  });
}

async function updateGateway(id, data) {
  return prisma.gateway.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      simcard: data.simcard,
      powerSource: data.powerSource,
      modelUnit: data.modelUnit,
      installationDate: data.installationDate
        ? new Date(data.installationDate)
        : undefined,
      installedById:
        data.installedById !== undefined
          ? data.installedById || null
          : undefined,
    },
    include: { installedBy: { select: { id: true, fullName: true } } },
  });
}

async function deleteGateway(id) {
  return prisma.gateway.delete({ where: { id } });
}

module.exports = {
  listGatewaysPaginated,
  getGatewayById,
  createGateway,
  updateGateway,
  deleteGateway,
};
