const { prisma } = require("../../../frameworks/database/prismaClient");
const {
  getDeviceAttributes,
  getTelemetryHistory,
  sendRelayCommandConfirmed,
  listTbDevices,
} = require("../../../frameworks/thingsboard/client");

const MAX_HISTORY_RANGE_DAYS = 90;

async function listDevicesPaginated({
  page = 1,
  rowsPerPage = 10,
  search,
} = {}) {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { roomId: { contains: search, mode: "insensitive" } },
          { gatewayId: { contains: search, mode: "insensitive" } },
        ],
      }
    : undefined;

  const [totalRows, devices] = await Promise.all([
    prisma.device.count({ where }),
    prisma.device.findMany({
      where,
      include: { room: true, gateway: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * rowsPerPage,
      take: rowsPerPage,
    }),
  ]);

  return {
    data: devices,
    page,
    rowsPerPage,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / rowsPerPage)),
  };
}

async function listDevices(filter = {}) {
  return prisma.device.findMany({
    where: {
      roomId: filter.roomId || undefined,
      gatewayId: filter.gatewayId || undefined,
    },
    include: { room: true, gateway: true },
    orderBy: { createdAt: "desc" },
  });
}

async function getDeviceById(id) {
  return prisma.device.findUnique({
    where: { id },
    include: { room: true, gateway: true },
  });
}

async function createDevice(data) {
  return prisma.device.create({
    data: {
      eui: data.eui,
      tbDeviceId: data.tbDeviceId || null,
      name: data.name,
      deviceType: data.deviceType,
      intervalMinutes: data.intervalMinutes || 5,
      roomId: data.roomId,
      gatewayId: data.gatewayId,
    },
  });
}

async function updateDevice(id, data) {
  return prisma.device.update({
    where: { id },
    data: {
      name: data.name,
      tbDeviceId: data.tbDeviceId,
      deviceType: data.deviceType,
      intervalMinutes: data.intervalMinutes,
      roomId: data.roomId,
      gatewayId: data.gatewayId,
    },
  });
}

async function deleteDevice(id) {
  return prisma.$transaction(async (tx) => {
    const device = await tx.device.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!device) {
      const err = new Error("Device tidak ditemukan");
      err.status = 404;
      throw err;
    }

    await tx.energyReading.deleteMany({
      where: { deviceId: id },
    });

    await tx.commandLog.updateMany({
      where: { deviceId: id },
      data: { deviceId: null },
    });

    await tx.schedule.updateMany({
      where: { deviceId: id },
      data: { deviceId: null },
    });

    return tx.device.delete({
      where: { id },
    });
  });
}

async function powerDevice(deviceId, action, options = {}) {
  const { userId = null, scheduleId = null } = options;
  const triggerType = scheduleId ? "scheduled" : "manual";

  const device = await prisma.device.findUnique({ where: { id: deviceId } });

  if (!device) {
    const err = new Error("Device tidak ditemukan");
    err.status = 404;
    throw err;
  }

  if (!device.tbDeviceId) {
    const err = new Error(
      "Device belum terhubung ke ThingsBoard (tbDeviceId kosong)",
    );
    err.status = 409;
    throw err;
  }

  let status = "success";
  let notes = null;

  try {
    await sendRelayCommandConfirmed(device.tbDeviceId, action);
  } catch (err) {
    status = "failed";
    notes = err.message;
  }

  await prisma.commandLog.create({
    data: {
      roomId: device.roomId,
      deviceId: device.id,
      action,
      triggerType,
      triggeredByUserId: userId,
      scheduleId,
      status,
      notes,
    },
  });

  if (status === "success") {
    await prisma.device.update({
      where: { id: deviceId },
      data: { status: action },
    });
  }

  return { deviceId, action, status, notes };
}

function parseHistoryRange(from, to) {
  if (!from || !to) {
    const err = new Error("Parameter 'from' dan 'to' wajib diisi (ISO date)");
    err.status = 400;
    throw err;
  }
  const startTs = new Date(from).getTime();
  const endTs = new Date(to).getTime();

  if (Number.isNaN(startTs) || Number.isNaN(endTs)) {
    const err = new Error("Format 'from'/'to' tidak valid");
    err.status = 400;
    throw err;
  }
  if (startTs > endTs) {
    const err = new Error("'from' tidak boleh lebih besar dari 'to'");
    err.status = 400;
    throw err;
  }
  const rangeDays = (endTs - startTs) / (1000 * 60 * 60 * 24);
  if (rangeDays > MAX_HISTORY_RANGE_DAYS) {
    const err = new Error(
      `Rentang maksimal ${MAX_HISTORY_RANGE_DAYS} hari (diminta: ${Math.round(rangeDays)} hari)`,
    );
    err.status = 400;
    throw err;
  }
  return { startTs, endTs };
}

async function requireTbDevice(deviceId) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    const err = new Error("Device tidak ditemukan");
    err.status = 404;
    throw err;
  }
  if (!device.tbDeviceId) {
    const err = new Error(
      "Device belum terhubung ke ThingsBoard (tbDeviceId kosong)",
    );
    err.status = 409;
    throw err;
  }
  return device;
}

async function getDeviceTbMetadata(deviceId) {
  const device = await requireTbDevice(deviceId);
  const attributes = await getDeviceAttributes(device.tbDeviceId);
  return { deviceId: device.id, tbDeviceId: device.tbDeviceId, attributes };
}

async function getDeviceTelemetryHistory(deviceId, { from, to, limit = 1000 }) {
  const device = await requireTbDevice(deviceId);
  const { startTs, endTs } = parseHistoryRange(from, to);

  const raw = await getTelemetryHistory(
    device.tbDeviceId,
    ["powerWatt", "usageKwh"],
    startTs,
    endTs,
    Number(limit),
  );

  const timeline = new Map();
  for (const [key, points] of Object.entries(raw || {})) {
    for (const point of points) {
      const entry = timeline.get(point.ts) || { ts: point.ts };
      entry[key] = Number(point.value);
      timeline.set(point.ts, entry);
    }
  }

  return {
    deviceId: device.id,
    from: new Date(startTs).toISOString(),
    to: new Date(endTs).toISOString(),
    points: [...timeline.values()].sort((a, b) => a.ts - b.ts),
  };
}

async function listTbDeviceCandidates({ page = 0, pageSize = 50 } = {}) {
  const tbResult = await listTbDevices({ page, pageSize });
  const tbIds = tbResult.data.map((d) => d.id.id);

  const mappedDevices = tbIds.length
    ? await prisma.device.findMany({
        where: { tbDeviceId: { in: tbIds } },
        select: { id: true, name: true, tbDeviceId: true },
      })
    : [];
  const mappedByTbId = new Map(mappedDevices.map((d) => [d.tbDeviceId, d]));

  return {
    data: tbResult.data.map((d) => ({
      tbDeviceId: d.id.id,
      name: d.name,
      type: d.type,
      isMapped: mappedByTbId.has(d.id.id),
      mappedTo: mappedByTbId.get(d.id.id) || null,
    })),
    page,
    totalElements: tbResult.totalElements ?? tbResult.data.length,
    hasNext: tbResult.hasNext ?? false,
  };
}

module.exports = {
  listDevicesPaginated,
  listDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  powerDevice,
  getDeviceTbMetadata,
  getDeviceTelemetryHistory,
  listTbDeviceCandidates,
};
