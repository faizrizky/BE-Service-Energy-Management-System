const { prisma } = require("../../../frameworks/database/prismaClient");
const {
  setRelay,
  pingTelemetry,
  listCsDevices,
  getCsDevice,
} = require("../../../frameworks/chirpstack/client");
const {
  parseRelayResponse,
} = require("../../../frameworks/chirpstack/contract");

const {
  emitDeviceCreated,
  emitDeviceUpdated,
  emitDeviceDeleted,
  emitDeviceStatus,
} = require("../../../frameworks/webserver/socket-events");

const MAX_HISTORY_RANGE_DAYS = 90;

const RELAY_CONFIRM_WAIT_MS = 60000;

async function listDevicesPaginated({
  page = 1,
  rowsPerPage = 10,
  search,
  gatewayId,
  roomId,
  createdFrom,
  createdTo,
} = {}) {
  const andConditions = [];

  if (roomId) {
    andConditions.push({
      roomId,
    });
  }

  if (gatewayId) {
    andConditions.push({
      gatewayId,
    });
  }
  if (search) {
    andConditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { roomId: { contains: search, mode: "insensitive" } },
        { gatewayId: { contains: search, mode: "insensitive" } },
        { eui: { contains: search, mode: "insensitive" } },
        { deviceType: { contains: search, mode: "insensitive" } },
        { room: { name: { contains: search, mode: "insensitive" } } },
        { gateway: { name: { contains: search, mode: "insensitive" } } },
        { tbDeviceId: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (createdFrom || createdTo) {
    const createdAt = {};
    if (createdFrom) createdAt.gte = new Date(createdFrom);
    if (createdTo) {
      const end = new Date(createdTo);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    andConditions.push({ createdAt });
  }

  const where = andConditions.length ? { AND: andConditions } : undefined;

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

  const now = new Date();

  return {
    data: devices,
    page,
    rowsPerPage,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / rowsPerPage)),
  };
}

async function getDeviceById(id) {
  return prisma.device.findUnique({
    where: { id },
    include: { room: true, gateway: true },
  });
}

async function createDevice(data) {
  const device = await prisma.device.create({
    data: {
      eui: data.eui,
      tbDeviceId: data.tbDeviceId || null,
      name: data.name,
      deviceType: data.deviceType,
      intervalMinutes: data.intervalMinutes || 15,
      roomId: data.roomId,
      gatewayId: data.gatewayId,
    },
  });
  emitDeviceCreated(device);
  return device;
}

async function updateDevice(id, data) {
  const device = await prisma.device.update({
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
  emitDeviceUpdated(device);
  return device;
}

async function deleteDevice(id) {
  const deleted = await prisma.$transaction(async (tx) => {
    const device = await tx.device.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!device) {
      const err = new Error("Device tidak ditemukan");
      err.status = 404;
      throw err;
    }

    await tx.energyReading.deleteMany({ where: { deviceId: id } });
    await tx.commandLog.updateMany({
      where: { deviceId: id },
      data: { deviceId: null },
    });
    await tx.schedule.updateMany({
      where: { deviceId: id },
      data: { deviceId: null },
    });

    return tx.device.delete({ where: { id } });
  });

  emitDeviceDeleted(deleted.id);
  return deleted;
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
      "Device belum terhubung ke ChirpStack (devEUI kosong)",
    );
    err.status = 409;
    throw err;
  }

  let status = "success";
  let notes = null;

  try {
    const raw = await setRelay(device.tbDeviceId, action === "on", {
      relayTimeout: RELAY_CONFIRM_WAIT_MS,
    });
    if (!parseRelayResponse(raw).confirmed) {
      status = "failed";
      notes = "Relay belum terkonfirmasi oleh device";
    }
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
    const updated = await prisma.device.update({
      where: { id: deviceId },
      data: { status: action },
    });
    emitDeviceStatus({
      deviceId: updated.id,
      eui: updated.eui,
      roomId: updated.roomId,
      status: updated.status,
      timestamp: new Date().toISOString(),
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

async function getDeviceChirpstackMetadata(deviceId) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    const err = new Error("Device tidak ditemukan");
    err.status = 404;
    throw err;
  }
  if (!device.tbDeviceId) {
    const err = new Error(
      "Device belum terhubung ke ChirpStack (devEUI kosong)",
    );
    err.status = 409;
    throw err;
  }
  const csDevice = await getCsDevice(device.tbDeviceId);
  return {
    deviceId: device.id,
    devEui: device.tbDeviceId,
    attributes: csDevice.data,
  };
}

async function getDeviceTelemetryHistory(deviceId, { from, to, limit = 1000 }) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    const err = new Error("Device tidak ditemukan");
    err.status = 404;
    throw err;
  }
  const { startTs, endTs } = parseHistoryRange(from, to); // fungsi lama, tetap dipakai

  const readings = await prisma.energyReading.findMany({
    where: {
      deviceId,
      recordedAt: { gte: new Date(startTs), lte: new Date(endTs) },
    },
    orderBy: { recordedAt: "asc" },
    take: Number(limit),
  });

  return {
    deviceId: device.id,
    from: new Date(startTs).toISOString(),
    to: new Date(endTs).toISOString(),
    points: readings.map((r) => ({
      ts: r.recordedAt.getTime(),
      powerWatt: r.powerWatt,
      usageKwh: r.usageKwh,
    })),
  };
}

async function listChirpstackDeviceCandidates() {
  const csResult = await listCsDevices();
  const devEuis = csResult.data.result.map((d) => d.devEui);

  const mappedDevices = devEuis.length
    ? await prisma.device.findMany({
        where: { tbDeviceId: { in: devEuis } },
        select: { id: true, name: true, tbDeviceId: true },
      })
    : [];
  const mappedByEui = new Map(mappedDevices.map((d) => [d.tbDeviceId, d]));

  return {
    data: csResult.data.result.map((d) => ({
      devEui: d.devEui,
      name: d.name,
      type: null,
      isMapped: mappedByEui.has(d.devEui),
      mappedTo: mappedByEui.get(d.devEui) || null,
    })),
    page: 0,
    totalElements: csResult.data.totalCount,
    hasNext: false,
  };
}

module.exports = {
  listDevicesPaginated,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  powerDevice,
  getDeviceChirpstackMetadata,
  getDeviceTelemetryHistory,
  listChirpstackDeviceCandidates,
};
