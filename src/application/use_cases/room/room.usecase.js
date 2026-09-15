const { prisma } = require("../../../frameworks/database/prismaClient");
const {
  requestRelayCommand,
  getPendingCommandsByDevice,
} = require("../device/device.usecase");
const { httpError } = require("../../../frameworks/helpers/httpError");
const {
  getHourlyConsumption,
  sumKwhByDevice,
  peakHourlyKwh,
} = require("../report/energy-consumption.util");
const {
  emitRoomCreated,
  emitRoomUpdated,
  emitRoomDeleted,
  emitRoomPower,
} = require("../../../frameworks/webserver/socket-events");

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * List room pake paginasi: device online/offline, pemakaian 24 jam, status
 * power, jumlah perintah pending, sama gateway pertamanya.
 *
 * Dipake di: room.controller.js → index (GET /api/rooms).
 */
async function listRoomsPaginated({
  page = 1,
  rowsPerPage = 10,
  search,
  createdFrom,
  createdTo,
} = {}) {
  const andConditions = [];

  if (search) {
    andConditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        {
          devices: {
            some: {
              gatewayId: { contains: search, mode: "insensitive" },
            },
          },
        },
        { location: { contains: search, mode: "insensitive" } },
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

  const where = andConditions.length ? { AND: andConditions } : {};

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

  const deviceIds = rooms.flatMap((room) => room.devices.map((d) => d.id));
  const [pendingByDevice, usageByDevice] = await Promise.all([
    getPendingCommandsByDevice(deviceIds),
    getUsage24hByDevice(deviceIds),
  ]);

  const now = new Date();
  const data = await Promise.all(
    rooms.map(async (room) => {
      const onlineDevices = room.devices.filter((d) => isDeviceOnline(d, now));
      const usagePerDevice = room.devices.map(
        (d) => usageByDevice.get(d.id) || 0,
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
        pendingCommandCount: room.devices.filter((d) =>
          pendingByDevice.has(d.id),
        ).length,
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

/**
 * Ringkasan energi 24 jam satu room dari selisih reading meter: total,
 * rata-rata per jam, puncak per jam, sama device yang paling boros.
 *
 * Dipake di: getRoomUsageSummary, getRoomById (file ini).
 */
async function computeRoomUsage(roomId) {
  const devices = await prisma.device.findMany({ where: { roomId } });
  const end = new Date();
  const consumption = await getHourlyConsumption({
    start: new Date(end.getTime() - ONE_DAY_MS),
    end,
    deviceIds: devices.map((device) => device.id),
  });
  const consumptionByDevice = sumKwhByDevice(consumption);

  const perDevice = devices.map((device) => ({
    name: device.name,
    totalKwh: consumptionByDevice.get(device.id) || 0,
  }));

  const total24hKwh = perDevice.reduce((sum, d) => sum + d.totalKwh, 0);
  const highest = perDevice.reduce(
    (best, d) => (d.totalKwh > (best?.totalKwh || 0) ? d : best),
    null,
  );

  return {
    total24hKwh: Number(total24hKwh.toFixed(2)),
    avg24hKwh: Number((total24hKwh / 24).toFixed(2)),
    peakKwh: Number(peakHourlyKwh(consumption).toFixed(2)),
    highestComponent: {
      name: highest?.name || "-",
      kwh: Number((highest?.totalKwh || 0).toFixed(2)),
    },
  };
}

/**
 * Ringkasan energi 24 jam satu room. Lempar 404 kalo room-nya nggak ada.
 *
 * Dipake di: room.controller.js → usageSummary (GET
 *   /api/rooms/:id/usage-summary).
 */
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

/**
 * Detail room + ringkasan energi + list device pake paginasi (bisa search &
 * tanggal). Balikin null kalo room-nya nggak ada.
 *
 * Dipake di: room.controller.js → show (GET /api/rooms/:id) dan devices (buat
 *   ngecek room-nya ada sebelum ngambil device).
 */
async function getRoomById(
  id,
  { page = 1, rowsPerPage = 10, search, createdFrom, createdTo } = {},
) {
  const andConditions = [];
  const room = await prisma.room.findUnique({ where: { id } });
  if (!room) return null;

  if (search) {
    andConditions.push({
      OR: [
        { tbDeviceId: { contains: search, mode: "insensitive" } },
        { eui: { contains: search, mode: "insensitive" } },
        { deviceType: { contains: search, mode: "insensitive" } },
        ...(Number.isInteger(Number(search))
          ? [{ intervalMinutes: Number(search) }]
          : []),
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

  const [totalRows, devices, usage] = await Promise.all([
    prisma.device.count({ where }),
    prisma.device.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * rowsPerPage,
      take: rowsPerPage,
    }),
    computeRoomUsage(id),
  ]);

  const [pendingByDevice, usageByDevice] = await Promise.all([
    getPendingCommandsByDevice(devices.map((d) => d.id)),
    getUsage24hByDevice(devices.map((d) => d.id)),
  ]);

  const deviceRows = await Promise.all(
    devices.map(async (device) => {
      const totalKwh = usageByDevice.get(device.id) || 0;
      return {
        id: device.id,
        tbDeviceId: device.tbDeviceId || device.eui,
        deviceEui: device.eui,
        deviceType: device.deviceType || "-",
        totalUsage24hKwh: Number(totalKwh.toFixed(2)),
        intervalMinutes: device.intervalMinutes,
        isPowerOn: device.status === "on",
        pendingCommand: pendingByDevice.get(device.id) ?? null,
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
 * List device punya satu room pake paginasi: search (angka juga dicocokin ke
 * interval), pemakaian 24 jam, status power, sama perintah pending.
 *
 * Dipake di: room.controller.js → devices (GET /api/rooms/:id/devices).
 */
async function listDevicesInRoom(
  roomId,
  { page = 1, rowsPerPage = 10, search, createdFrom, createdTo } = {},
) {
  const andConditions = [{ roomId }];

  if (search) {
    andConditions.push({
      OR: [
        { tbDeviceId: { contains: search, mode: "insensitive" } },
        { eui: { contains: search, mode: "insensitive" } },
        { deviceType: { contains: search, mode: "insensitive" } },
        ...(Number.isInteger(Number(search))
          ? [{ intervalMinutes: Number(search) }]
          : []),
      ],
    });
  }

  if (createdFrom || createdTo) {
    const createdAt = {};

    if (createdFrom) {
      createdAt.gte = new Date(createdFrom);
    }

    if (createdTo) {
      const end = new Date(createdTo);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }

    andConditions.push({ createdAt });
  }

  const where = { AND: andConditions };

  const [totalRows, devices] = await Promise.all([
    prisma.device.count({ where }),

    prisma.device.findMany({
      where,
      include: { gateway: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * rowsPerPage,
      take: rowsPerPage,
    }),
  ]);

  const pendingByDevice = await getPendingCommandsByDevice(
    devices.map((d) => d.id),
  );

  const usageByDevice = await getUsage24hByDevice(devices.map((d) => d.id));

  const deviceRows = await Promise.all(
    devices.map(async (device) => ({
      id: device.id,
      tbDeviceId: device.tbDeviceId || device.eui,
      deviceEui: device.eui,
      component: device.deviceType || "-",
      totalUsage24hKwh: Number(
        (usageByDevice.get(device.id) || 0).toFixed(2),
      ),
      intervalMinutes: device.intervalMinutes,
      isPowerOn: device.status === "on",
      pendingCommand: pendingByDevice.get(device.id) ?? null,
    })),
  );

  return {
    data: deviceRows,
    page,
    rowsPerPage,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / rowsPerPage)),
  };
}

const ONLINE_THRESHOLD_MULTIPLIER = 2;

/**
 * Device dianggep online kalo lastSeenAt-nya belom lewat 2× interval laporan.
 *
 * Dipake di: listRoomsPaginated, listRoomsSummary, getRoomStats (file ini).
 */
function isDeviceOnline(device, now) {
  if (!device.lastSeenAt) return false;
  const thresholdMs =
    device.intervalMinutes * ONLINE_THRESHOLD_MULTIPLIER * 60 * 1000;
  return now.getTime() - device.lastSeenAt.getTime() <= thresholdMs;
}

/**
 * Pemakaian 24 jam (selisih reading meter, tahan meter reset) buat banyak
 * device sekaligus, cukup satu query. Hasil: Map deviceId → kWh.
 *
 * Dipake di: listRoomsPaginated, getRoomById, listDevicesInRoom,
 *   listRoomsSummary (file ini).
 */
async function getUsage24hByDevice(deviceIds) {
  const end = new Date();
  const consumption = await getHourlyConsumption({
    start: new Date(end.getTime() - ONE_DAY_MS),
    end,
    deviceIds,
  });
  return sumKwhByDevice(consumption);
}

/**
 * Ringkasan semua room tanpa paginasi (gateway, device online/offline,
 * pemakaian 24 jam, status), bisa difilter nama.
 *
 * Dipake di: room.controller.js → summary (GET /api/rooms/summary).
 */
async function listRoomsSummary(filter = {}) {
  const rooms = await prisma.room.findMany({
    where: filter.search
      ? { name: { contains: filter.search, mode: "insensitive" } }
      : undefined,
    include: { devices: { include: { gateway: true } } },
    orderBy: { createdAt: "desc" },
  });

  const usageByDevice = await getUsage24hByDevice(
    rooms.flatMap((room) => room.devices.map((d) => d.id)),
  );
  const now = new Date();

  return Promise.all(
    rooms.map(async (room) => {
      const onlineDevices = room.devices.filter((d) => isDeviceOnline(d, now));
      const usagePerDevice = room.devices.map(
        (d) => usageByDevice.get(d.id) || 0,
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
 * Statistik total room, gateway, sama device plus online/offline-nya. Gateway
 * dianggep online kalo minimal satu device-nya online.
 *
 * Dipake di: room.controller.js → stats (GET /api/rooms/stats).
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

/**
 * Nyimpen room baru (isCritical default false) terus ngirim event
 * room:created.
 *
 * Dipake di: room.controller.js → store (POST /api/rooms).
 */
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

/**
 * Ngedit data room terus ngirim event room:updated.
 *
 * Dipake di: room.controller.js → update (PUT/PATCH /api/rooms/:id).
 */
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

/**
 * Hapus room yang udah nggak punya device (409 kalo masih ada), sekalian
 * CommandLog & Schedule-nya dalam satu transaksi. Terus ngirim event
 * room:deleted.
 *
 * Dipake di: room.controller.js → destroy (DELETE /api/rooms/:id).
 */
async function deleteRoom(id) {
  const deviceCount = await prisma.device.count({ where: { roomId: id } });
  if (deviceCount > 0) {
    throw httpError(
      `Room tidak bisa dihapus karena masih memiliki ${deviceCount} device. ` +
        "Pindahkan atau hapus device tersebut terlebih dahulu.",
      409,
    );
  }

  const deleted = await prisma.$transaction(async (tx) => {
    await tx.commandLog.deleteMany({ where: { roomId: id } });
    await tx.schedule.deleteMany({ where: { roomId: id } });
    return tx.room.delete({ where: { id } });
  });

  emitRoomDeleted(deleted.id);
  return deleted;
}

/**
 * Bikin perintah ON/OFF buat semua device di room lewat antrean, terus balikin
 * hasil per device plus ringkasan pending/failed. Ngirim event room:power
 * juga.
 *
 * Dipake di: room.controller.js → power (POST /api/rooms/:id/power).
 */
async function powerRoom(roomId, action, options = {}) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { devices: true },
  });

  if (!room) throw httpError("Room tidak ditemukan", 404);

  const results = [];

  for (const device of room.devices) {
    results.push(await requestRelayCommand(device, action, options));
  }

  const summary = {
    total: results.length,
    pending: results.filter((r) => r.status === "pending").length,
    failed: results.filter((r) => r.status === "failed").length,
  };

  emitRoomPower(roomId, results);

  return { roomId, action, results, summary };
}

/**
 * Nambahin nol di depan angka satu digit (7 → "07").
 *
 * Dipake di: toDateStr, toTimeStr (file ini).
 */
function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Format tanggal lokal jadi YYYY-MM-DD.
 *
 * Dipake di: getDeviceLogs (file ini).
 */
function toDateStr(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Format jam lokal jadi HH:mm.
 *
 * Dipake di: getDeviceLogs (file ini).
 */
function toTimeStr(date) {
  const d = new Date(date);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Nyusun kalimat log perintah sesuai status-nya (pending, cancelled, failed,
 * gateway_offline, sukses manual/terjadwal).
 *
 * Dipake di: getDeviceLogs (file ini).
 */
function buildLogDescription(log) {
  const actionLabel = log.action === "on" ? "ON" : "OFF";

  if (log.status === "failed") {
    return `Failed to turn ${actionLabel}${log.notes ? ` (${log.notes})` : ""}`;
  }
  if (log.status === "pending") {
    return `Turning ${actionLabel}, waiting for meter${log.notes ? ` (${log.notes})` : ""}`;
  }
  if (log.status === "cancelled") {
    return `Command to turn ${actionLabel} cancelled${log.notes ? ` (${log.notes})` : ""}`;
  }
  if (log.status === "gateway_offline") {
    return `Gateway offline, could not turn ${actionLabel}`;
  }
  return log.triggerType === "scheduled"
    ? `Scheduled: device turned ${actionLabel}`
    : `Device turned ${actionLabel} manually`;
}

/**
 * Riwayat perintah satu device di room tertentu (terbaru duluan) plus PIC &
 * role yang mencet. Lempar 404 kalo device-nya bukan punya room itu.
 *
 * Dipake di: room.controller.js → deviceLogs (GET
 *   /api/rooms/:id/devices/:deviceId/logs).
 */
async function getDeviceLogs(roomId, deviceId) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });

  if (!device || device.roomId !== roomId) {
    throw httpError("Device tidak ditemukan di room ini", 404);
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
