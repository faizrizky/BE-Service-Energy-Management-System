const { prisma } = require("../../../frameworks/database/prismaClient");
const {
  emitGatewayCreated,
  emitGatewayUpdated,
  emitGatewayDeleted,
} = require("../../../frameworks/webserver/socket-events");

const ONLINE_THRESHOLD_MULTIPLIER = 2;

function isDeviceOnline(device, now) {
  if (!device.lastSeenAt) return false;
  const thresholdMs =
    device.intervalMinutes * ONLINE_THRESHOLD_MULTIPLIER * 60 * 1000;
  return now.getTime() - device.lastSeenAt.getTime() <= thresholdMs;
}

function computeGatewayStatus(device, now) {
  return device.some((d) => isDeviceOnline(d, now)) ? "online" : "offline";
}

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
          { modelUnit: { contains: search, mode: "insensitive" } },
          { simcard: { contains: search, mode: "insensitive" } },
          { powerSource: { contains: search, mode: "insensitive" } },
        ],
      }
    : undefined;

  const [totalRows, gateways] = await Promise.all([
    prisma.gateway.count({ where }),
    prisma.gateway.findMany({
      where,
      include: {
        installedBy: { select: { id: true, fullName: true } },
        devices: { select: { lastSeenAt: true, intervalMinutes: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * rowsPerPage,
      take: rowsPerPage,
    }),
  ]);

  const now = new Date();
  const data = gateways.map(({ devices, ...gateway }) => ({
    ...gateway,
    status: computeGatewayStatus(devices, now),
  }));

  return {
    data,
    page,
    rowsPerPage,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / rowsPerPage)),
  };
}

async function getGatewayById(id) {
  const gateway = await prisma.gateway.findUnique({
    where: { id },
    include: {
      devices: true,
      installedBy: { select: { id: true, fullName: true, username: true } },
    },
  });
  if (!gateway) return null;

  return {
    ...gateway,
    status: computeGatewayStatus(gateway.devices, new Date()),
  };
}

async function createGateway(data) {
  const gateway = await prisma.gateway.create({
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
  emitGatewayCreated({ ...gateway, status: "offline" });
  return gateway;
}

async function updateGateway(id, data) {
  const gateway = await prisma.gateway.update({
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
  emitGatewayUpdated(gateway);
  return gateway;
}

async function deleteGateway(id) {
  const deviceCount = await prisma.device.count({ where: { gatewayId: id } });
  if (deviceCount > 0) {
    const err = new Error(
      `Gateway tidak bisa dihapus karena masih memiliki ${deviceCount} device. Pindahkan atau hapus device tersebut terlebih dahulu.`,
    );
    err.status = 409;
    throw err;
  }

  const deleted = await prisma.gateway.delete({ where: { id } });
  emitGatewayDeleted(deleted.id);
  return deleted;
}

module.exports = {
  listGatewaysPaginated,
  getGatewayById,
  createGateway,
  updateGateway,
  deleteGateway,
};
