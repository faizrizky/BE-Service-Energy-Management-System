const { prisma } = require("../../../frameworks/database/prismaClient");
const { config } = require("../../../config/config");

function getRangeBounds(range) {
  const now = new Date();
  const start = new Date(now);

  switch (range) {
    case "today":
      start.setHours(0, 0, 0, 0);
      break;
    case "week":
      start.setDate(start.getDate() - 7);
      break;
    case "month":
      start.setDate(start.getDate() - 30);
      break;
    default: {
      const err = new Error(
        `Parameter 'range' tidak valid: "${range}". Harus salah satu dari: today, week, month`,
      );
      err.status = 400;
      throw err;
    }
  }

  return { start, end: now };
}

function parseDateStrict(value, label) {
  if (!value) {
    const err = new Error(
      `Parameter '${label}' wajib diisi (format: YYYY-MM-DD)`,
    );
    err.status = 400;
    throw err;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const err = new Error(
      `Parameter '${label}' harus format YYYY-MM-DD, contoh: 2026-08-01 (diterima: "${value}")`,
    );
    err.status = 400;
    throw err;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    const err = new Error(
      `Parameter '${label}' bukan tanggal yang valid: "${value}"`,
    );
    err.status = 400;
    throw err;
  }
  return date;
}

async function getDeviceUsage(deviceId, range) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) {
    const err = new Error("Device tidak ditemukan");
    err.status = 404;
    throw err;
  }

  const { start, end } = getRangeBounds(range);

  const agg = await prisma.energyReading.aggregate({
    where: { deviceId, recordedAt: { gte: start, lte: end } },
    _sum: { usageKwh: true },
    _avg: { powerWatt: true },
    _count: true,
  });

  return {
    deviceId,
    deviceName: device.name,
    range,
    from: start,
    to: end,
    totalUsageKwh: agg._sum.usageKwh || 0,
    avgPowerWatt: agg._avg.powerWatt || 0,
    readingCount: agg._count,
  };
}

async function getRoomUsage(roomId, range) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { devices: true },
  });
  if (!room) {
    const err = new Error("Room tidak ditemukan");
    err.status = 404;
    throw err;
  }

  const { start, end } = getRangeBounds(range);

  if (room.devices.length === 0) {
    return {
      roomId,
      roomName: room.name,
      range,
      from: start,
      to: end,
      totalUsageKwh: 0,
      devices: [],
    };
  }

  const perDevice = await Promise.all(
    room.devices.map(async (device) => {
      const agg = await prisma.energyReading.aggregate({
        where: { deviceId: device.id, recordedAt: { gte: start, lte: end } },
        _sum: { usageKwh: true },
      });
      return {
        deviceId: device.id,
        deviceName: device.name,
        usageKwh: agg._sum.usageKwh || 0,
      };
    }),
  );

  const totalUsageKwh = perDevice.reduce((sum, d) => sum + d.usageKwh, 0);

  return {
    roomId,
    roomName: room.name,
    range,
    from: start,
    to: end,
    totalUsageKwh,
    devices: perDevice,
  };
}

async function getDashboardSummary() {
  const [
    totalRooms,
    totalDevices,
    activeDevices,
    totalGateways,
    onlineGateways,
    activeSchedules,
  ] = await Promise.all([
    prisma.room.count(),
    prisma.device.count(),
    prisma.device.count({ where: { status: "on" } }),
    prisma.gateway.count(),
    prisma.gateway.count({ where: { status: "online" } }),
    prisma.schedule.count({ where: { status: "active" } }),
  ]);

  const { start, end } = getRangeBounds("today");
  const todayUsage = await prisma.energyReading.aggregate({
    where: { recordedAt: { gte: start, lte: end } },
    _sum: { usageKwh: true },
  });

  return {
    totalRooms,
    totalDevices,
    activeDevices,
    totalGateways,
    onlineGateways,
    activeSchedules,
    todayUsageKwh: todayUsage._sum.usageKwh || 0,
  };
}

const MAX_EXPORT_RANGE_DAYS = 366;

async function exportEnergyReport({ roomId, deviceId, from, to }) {
  const fromDate = parseDateStrict(from, "from");
  const toDate = parseDateStrict(to, "to");
  toDate.setHours(23, 59, 59, 999);

  if (fromDate > toDate) {
    const err = new Error(
      `Parameter 'from' (${from}) tidak boleh lebih besar dari 'to' (${to})`,
    );
    err.status = 400;
    throw err;
  }

  const rangeDays = (toDate - fromDate) / (1000 * 60 * 60 * 24);
  if (rangeDays > MAX_EXPORT_RANGE_DAYS) {
    const err = new Error(
      `Rentang tanggal terlalu panjang (${Math.round(rangeDays)} hari), maksimal ${MAX_EXPORT_RANGE_DAYS} hari`,
    );
    err.status = 400;
    throw err;
  }

  if (roomId) {
    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      const err = new Error(`Room dengan id "${roomId}" tidak ditemukan`);
      err.status = 404;
      throw err;
    }
  }

  if (deviceId) {
    const device = await prisma.device.findUnique({ where: { id: deviceId } });
    if (!device) {
      const err = new Error(`Device dengan id "${deviceId}" tidak ditemukan`);
      err.status = 404;
      throw err;
    }
  }

  const readings = await prisma.energyReading.findMany({
    where: {
      recordedAt: { gte: fromDate, lte: toDate },
      device: { roomId: roomId || undefined, id: deviceId || undefined },
    },
    include: { device: { include: { room: true } } },
    orderBy: { recordedAt: "asc" },
  });

  return readings.map((r) => ({
    recordedAt: r.recordedAt,
    roomName: r.device?.room?.name || "-",
    deviceName: r.device?.name || "-",
    powerWatt: r.powerWatt,
    usageKwh: r.usageKwh,
  }));
}

function toCsv(rows) {
  const header = "recordedAt,roomName,deviceName,powerWatt,usageKwh";
  const lines = rows.map((r) =>
    [
      r.recordedAt.toISOString(),
      `"${r.roomName}"`,
      `"${r.deviceName}"`,
      r.powerWatt ?? "",
      r.usageKwh ?? "",
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

/**
 * (webhook masuk tiap ~10 detik per device yang nyala).
 */
async function pruneOldReadings() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - config.energyRetention.days);

  const result = await prisma.energyReading.deleteMany({
    where: { recordedAt: { lt: cutoff } },
  });

  return { deletedCount: result.count, cutoff };
}

module.exports = {
  getDeviceUsage,
  getRoomUsage,
  getDashboardSummary,
  exportEnergyReport,
  toCsv,
  pruneOldReadings,
};
