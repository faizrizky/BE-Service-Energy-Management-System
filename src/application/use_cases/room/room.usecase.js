const { prisma } = require("../../../frameworks/database/prismaClient");
const { sendRelayCommand } = require("../../../frameworks/thingsboard/client");

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

async function listRooms() {
  return prisma.room.findMany({
    include: { devices: true },
    orderBy: { createdAt: "desc" },
  });
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

  return {
    totalRooms,
    totalGateways: gateways.length,
    gatewaysOnline: gatewaysWithOnlineDevice.size,
    gatewaysOffline: gateways.length - gatewaysWithOnlineDevice.size,
    totalDevices: devices.length,
    devicesOnline,
    devicesOffline: devices.length - devicesOnline,
  };
}

async function getRoomById(id) {
  return prisma.room.findUnique({
    where: { id },
    include: { devices: { include: { gateway: true } } },
  });
}

async function createRoom(data) {
  return prisma.room.create({
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
}

async function updateRoom(id, data) {
  return prisma.room.update({
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
}

async function deleteRoom(id) {
  return prisma.room.delete({ where: { id } });
}

async function listDevicesInRoom(roomId) {
  return prisma.device.findMany({
    where: { roomId },
    include: { gateway: true },
  });
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
        await sendRelayCommand(device.tbDeviceId, action);
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

  return { roomId, action, results };
}

module.exports = {
  listRooms,
  listRoomsSummary,
  getRoomStats,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  listDevicesInRoom,
  powerRoom,
};
