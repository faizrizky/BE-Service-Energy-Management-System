const { prisma } = require("../../../frameworks/database/prismaClient");
const {
  sendRelayCommandConfirmed,
} = require("../../../frameworks/thingsboard/client");

const {
  emitRoomCreated,
  emitRoomUpdated,
  emitRoomDeleted,
  emitRoomPower,
} = require("../../../frameworks/webserver/socket-events");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function listRoomsPaginated({ page = 1, rowsPerPage = 10, search } = {}) {
  const where = {
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            {
              devices: {
                some: {
                  gatewayId: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              },
            },
            { location: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [totalRows, rooms] = await Promise.all([
    prisma.room.count({ where }),
    prisma.room.findMany({
      where,
      include: { devices: { include: { gateway: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * rowsPerPage,
      take: rowsPerPage,
    }),
  ]);

  const now = new Date();
  const data = await Promise.all(
    rooms.map(async (room) => {
      const onlineDevices = room.devices.filter((d) => isDeviceOnline(d, now));
      const usagePerDevice = await Promise.all(
        room.devices.map((d) => computeDeviceUsage24h(d.id)),
      );
      return {
        id: room.id,
        name: room.name,
        location: room.location,
        gatewayId: room.devices[0]?.gatewayId ?? null,
        devicesOnline: onlineDevices.length,
        devicesOffline: room.devices.length - onlineDevices.length,
        totalUsage24hKwh: Number(
          usagePerDevice.reduce((s, v) => s + v, 0).toFixed(2),
        ),
        isPowerOn: room.devices.some((d) => d.status === "on"),
        isCritical: room.isCritical,
      };
    }),
  );

  return {
    data,
    page,
    rowsPerPage,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / rowsPerPage)),
  };
}

async function computeRoomUsage(roomId) {
  const devices = await prisma.device.findMany({ where: { roomId } });
  const since = new Date(Date.now() - ONE_DAY_MS);

  const perDevice = await Promise.all(
    devices.map(async (device) => {
      const agg = await prisma.energyReading.aggregate({
        where: { devideId: device.id, recordedAt: { gte: since } },
        _sum: { usageKwh: true },
        _avg: { usageKwh: true },
        _max: { usageKwh: true },
      });
      return {
        name: device.name,
        totalKwh: agg._sum.usageKwh || 0,
        avgKwh: agg._avg.usageKwh || 0,
        peakKwh: agg._max.usageKwh || 0,
      };
    }),
  );

  const total24Kwh = perDevice.reduce((sum, d) => sum + d.totalKwh, 0);
  const avg24Kwh = perDevice.length
    ? perDevice.reduce((sumd, d) => sum + d.avgKwh, 0) / perDevice.length
    : 0;
  const peakKwh = perDevice.reduce((max, d) => Math.max(max, d.peakKwh), 0);
  const highest = perDevice.reduce(
    (best, d) => (best?.totalKwh || 0 ? d : best),
    null,
  );

  return {
    total24Kwh: Number(total24Kwh.toFixed(2)),
    avg24Kwh: Number(avg24Kwh.toFixed(2)),
    peakKwh: Number(peakKwh.toFixed(2)),
    highestComponent: {
      name: highest?.name || "-",
      kwh: Number((highest?.totalKwh || 0).toFixed(2)),
    },
  };
}

async function getRoomUsageSummary(roomId) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    select: { id: true },
  });
  if (!room) {
    const err = new Error("Room tidak ditemukan");
    err.status = 404;
    throw err;
  }
  return computeRoomUsage(roomId);
}

async function getRoomById(id, { page = 1, rowsPerPage = 10, search } = {}) {
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) return null;

  const deviceWhere = {
    roomId: id,
    ...(search
      ? {
          OR: [
            { tbDeviceId: { contains: search, mode: "insensitive" } },
            { eui: { contains: search, mode: "insensitive" } },
            { deviceType: { contains: search, mode: "insensitive" } },
            ...(Number.isInteger(Number(search))
              ? [{ intervalMinutes: Number(search) }]
              : []),
          ],
        }
      : {}),
  };

  const [totalRows, devices, usage] = await Promise.all([
    prisma.device.count({ where: deviceWhere }),
    prisma.device.findMany({
      where: deviceWhere,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * rowsPerPage,
      take: rowsPerPage,
    }),
    computeRoomUsage(id), // <- selalu dari semua device, gak kena efek pagination di atas
  ]);

  const since = new Date(Date.now() - ONE_DAY_MS);

  const deviceRows = await Promise.all(
    devices.map(async (device) => {
      const agg = await prisma.energyReading.aggregate({
        where: { deviceId: device.id, recordedAt: { gte: since } },
        _sum: { usageKwh: true },
      });
      const totalKwh = agg._sum.usageKwh || 0;
      return {
        id: device.id,
        tbDeviceId: device.tbDeviceId || device.eui,
        deviceEui: device.eui,
        deviceType: device.deviceType || "-",
        totalUsage24hKwh: Number(totalKwh.toFixed(2)),
        intervalMinutes: device.intervalMinutes,
        isPowerOn: device.status === "on",
      };
    }),
  );

  return {
    ...room,
    lastUpdatedAt: room.updatedAt,
    usage,
    devices: {
      data: deviceRows,
      page,
      rowsPerPage,
      totalRows,
      totalPages: Math.max(1, Math.ceil(totalRows / rowsPerPage)),
    },
  };
}

/**
 * Misal device interval 5 menit, ditoleransi sampai 10 menit tanpa lapor
 */
const ONLINE_THRESHOLD_MULTIPLIER = 2;

function isDeviceOnline(device, now) {
  if (!device.lastSeenAt) return false;
  const thresholdMs =
    device.intervalMinutes * ONLINE_THRESHOLD_MULTIPLIER * 60 * 1000;
  return now.getTime() - device.lastSeenAt.getTime() <= thresholdMs;
}

async function computeDeviceUsage24h(deviceId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [latest, earliest] = await Promise.all([
    prisma.energyReading.findFirst({
      where: { deviceId, recordedAt: { gte: since } },
      orderBy: { recordedAt: "desc" },
    }),
    prisma.energyReading.findFirst({
      where: { deviceId, recordedAt: { gte: since } },
      orderBy: { recordedAt: "asc" },
    }),
  ]);

  if (
    !latest ||
    !earliest ||
    latest.usageKwh == null ||
    earliest.usageKwh == null
  )
    return 0;
  return Math.max(0, latest.usageKwh - earliest.usageKwh);
}

async function listRoomsSummary(filter = {}) {
  const rooms = await prisma.room.findMany({
    where: filter.search
      ? { name: { contains: filter.search, mode: "insensitive" } }
      : undefined,
    include: { devices: { include: { gateway: true } } },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();

  return Promise.all(
    rooms.map(async (room) => {
      const onlineDevices = room.devices.filter((d) => isDeviceOnline(d, now));
      const usagePerDevice = await Promise.all(
        room.devices.map((d) => computeDeviceUsage24h(d.id)),
      );
      const totalUsage24hKwh = usagePerDevice.reduce((sum, v) => sum + v, 0);

      return {
        id: room.id,
        name: room.name,
        location: room.location,
        gatewayEui: room.devices[0]?.gateway?.eui ?? null,
        deviceOnlineCount: onlineDevices.length,
        deviceOfflineCount: room.devices.length - onlineDevices.length,
        totalUsage24hKwh: Number(totalUsage24hKwh.toFixed(2)),
        status: room.devices.some((d) => d.status === "on") ? "on" : "off",
        isCritical: room.isCritical,
      };
    }),
  );
}

/**
 * Ringkasan agregat untuk stat card (Dashboard & Rooms). Gateway dianggap
 * online kalau minimal satu device di bawahnya online
 */
async function getRoomStats() {
  const now = new Date();

  const [totalRooms, gateways, devices] = await Promise.all([
    prisma.room.count(),
    prisma.gateway.findMany({ select: { id: true } }),
    prisma.device.findMany({
      select: {
        id: true,
        gatewayId: true,
        lastSeenAt: true,
        intervalMinutes: true,
      },
    }),
  ]);

  const onlineDeviceIds = new Set(
    devices.filter((d) => isDeviceOnline(d, now)).map((d) => d.id),
  );
  const devicesOnline = onlineDeviceIds.size;

  const gatewaysWithOnlineDevice = new Set(
    devices.filter((d) => onlineDeviceIds.has(d.id)).map((d) => d.gatewayId),
  );
  const gatewaysOnline = gatewaysWithOnlineDevice.size;

  return {
    totalRooms,
    totalGateways: {
      total: gateways.length,
      online: gatewaysOnline,
      offline: gateways.length - gatewaysOnline,
    },
    totalDevices: {
      total: devices.length,
      online: devicesOnline,
      offline: devices.length - devicesOnline,
    },
  };
}

async function createRoom(data) {
  const room = await prisma.room.create({
    data: {
      name: data.name,
      picName: data.picName,
      picPhone: data.picPhone,
      location: data.location,
      description: data.description,
      imageUrl: data.imageUrl,
      isCritical: data.isCritical || false,
    },
  });
  emitRoomCreated(room);
  return room;
}

async function updateRoom(id, data) {
  const room = await prisma.room.update({
    where: { id },
    data: {
      name: data.name,
      picName: data.picName,
      picPhone: data.picPhone,
      location: data.location,
      description: data.description,
      imageUrl: data.imageUrl,
      isCritical: data.isCritical,
    },
  });
  emitRoomUpdated(room);
  return room;
}

async function deleteRoom(id) {
  const deviceCount = await prisma.device.count({ where: { roomId: id } });
  if (deviceCount > 0) {
    const err = new Error(
      `Room tidak bisa dihapus karena masih memiliki ${deviceCount} device. Pindahkan atau hapus device tersebut terlebih dahulu.`,
    );
    err.status = 409;
    throw err;
  }

  const deleted = await prisma.$transaction(async (tx) => {
    await tx.commandLog.deleteMany({ where: { roomId: id } });
    await tx.schedule.deleteMany({ where: { roomId: id } });
    return tx.room.delete({ where: { id } });
  });

  emitRoomDeleted(deleted.id);
  return deleted;
}

async function listDevicesInRoom(roomId) {
  const devices = await prisma.device.findMany({
    where: { roomId },
    include: { gateway: true },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    devices.map(async (device) => ({
      id: device.id,
      tbDeviceId: device.tbDeviceId || device.eui,
      deviceEui: device.eui,
      component: device.deviceType || "-",
      totalUsage24hKwh: Number(
        (await computeDeviceUsage24h(device.id)).toFixed(2),
      ),
      intervalMinutes: device.intervalMinutes,
      isPowerOn: device.status === "on",
    })),
  );
}

async function powerRoom(roomId, action, options = {}) {
  const { userId = null, scheduleId = null } = options;
  const triggerType = scheduleId ? "scheduled" : "manual";

  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { devices: true },
  });

  if (!room) {
    const err = new Error("Room tidak ditemukan");
    err.status = 404;
    throw err;
  }

  const results = [];

  for (const device of room.devices) {
    let status = "success";
    let notes = null;

    if (!device.tbDeviceId) {
      status = "failed";
      notes = "Device belum terhubung ke ThingsBoard (tbDeviceId kosong)";
    } else {
      try {
        await sendRelayCommandConfirmed(device.tbDeviceId, action);
      } catch (err) {
        status = "failed";
        notes = err.message;
      }
    }

    await prisma.commandLog.create({
      data: {
        roomId: room.id,
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
        where: { id: device.id },
        data: { status: action },
      });
    }

    results.push({ deviceId: device.id, status, notes });
  }
  emitRoomPower(roomId, results);

  return { roomId, action, results };
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toDateStr(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function toTimeStr(date) {
  const d = new Date(date);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function buildLogDescription(log) {
  const actionLabel = log.action === "on" ? "ON" : "OFF";

  if (log.status === "failed") {
    return `Failed to turn ${actionLabel}${log.notes ? ` (${log.notes})` : ""}`;
  }
  if (log.status === "gateway_offline") {
    return `Gateway offline, could not turn ${actionLabel}`;
  }
  return log.triggerType === "scheduled"
    ? `Scheduled: device turned ${actionLabel}`
    : `Device turned ${actionLabel} manually`;
}

async function getDeviceLogs(roomId, deviceId) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });

  if (!device || device.roomId !== roomId) {
    const err = new Error("Device tidak ditemukan di room ini");
    err.status = 404;
    throw err;
  }

  const logs = await prisma.commandLog.findMany({
    where: { roomId, deviceId },
    include: { triggeredBy: { include: { role: true } } },
    orderBy: { executedAt: "desc" },
  });

  return logs.map((log) => ({
    id: log.id,
    date: toDateStr(log.executedAt),
    time: toTimeStr(log.executedAt),
    description: buildLogDescription(log),
    picName:
      log.triggerType === "scheduled"
        ? "System"
        : log.triggeredBy?.fullName || "-",
    picRole:
      log.triggerType === "scheduled"
        ? "Scheduled Job"
        : log.triggeredBy?.role?.name || "-",
  }));
}

module.exports = {
  listRoomsPaginated,
  listRoomsSummary,
  getRoomStats,
  getRoomById,
  getRoomUsageSummary,
  createRoom,
  updateRoom,
  deleteRoom,
  listDevicesInRoom,
  powerRoom,
  getDeviceLogs,
};
