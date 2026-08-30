const { prisma } = require("../../../frameworks/database/prismaClient");
const { config } = require("../../../config/config");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const ONLINE_THRESHOLD_MULTIPLIER = 2;

const RANGE_DAYS = {
  today: 1,
  last_week: 7,
  last_month: 30,
  last_year: 365,
};

function isDeviceOnline(device, now) {
  if (!device.lastSeenAt) return false;
  const thresholdMs =
    device.intervalMinutes * ONLINE_THRESHOLD_MULTIPLIER * 60 * 1000;
  return now.getTime() - device.lastSeenAt.getTime() <= thresholdMs;
}

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
  if (!value || typeof value !== "string") {
    const err = new Error(
      `Parameter '${label}' wajib diisi (format: YYYY-MM-DD)`,
    );
    err.status = 400;
    throw err;
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    const err = new Error(
      `Parameter '${label}' harus format YYYY-MM-DD, contoh: 2026-08-01 (diterima: "${value}")`,
    );
    err.status = 400;
    throw err;
  }

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(year, month - 1, day);

  const isRealCalendarDate =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;

  if (!isRealCalendarDate) {
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
  const now = new Date();
  const { start: todayStart, end: todayEnd } = getRangeBounds("today");
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);

  const [
    totalDevices,
    devices,
    totalGateways,
    onlineGateways,
    todayUsage,
    yesterdayUsage,
  ] = await Promise.all([
    prisma.device.count(),
    prisma.device.findMany({
      select: { lastSeenAt: true, intervalMinutes: true },
    }),
    prisma.gateway.count(),
    prisma.gateway.count({ where: { status: "online" } }),
    prisma.energyReading.aggregate({
      where: { recordedAt: { gte: todayStart, lte: todayEnd } },
      _sum: { usageKwh: true },
    }),
    prisma.energyReading.aggregate({
      where: { recordedAt: { gte: yesterdayStart, lt: todayStart } },
      _sum: { usageKwh: true },
    }),
  ]);

  const devicesOnline = devices.filter((d) => isDeviceOnline(d, now)).length;
  const totalKwh = todayUsage._sum.usageKwh || 0;
  const yesterdayKwh = yesterdayUsage._sum.usageKwh || 0;
  const changePercentFromYesterday =
    yesterdayKwh > 0
      ? Number((((totalKwh - yesterdayKwh) / yesterdayKwh) * 100).toFixed(1))
      : 0;

  return {
    energyUsage: {
      totalKwh: Number(totalKwh.toFixed(2)),
      changePercentFromYesterday,
    },
    gateways: {
      total: totalGateways,
      online: onlineGateways,
      offline: totalGateways - onlineGateways,
    },
    devices: {
      total: totalDevices,
      online: devicesOnline,
      offline: totalDevices - devicesOnline,
    },
  };
}

function bucketKey(date, granularity) {
  const d = new Date(date);
  if (granularity === "hour")
    return `${String(d.getHours()).padStart(2, "0")}.00`;
  if (granularity === "day")
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function getEnergyUsageTimeline(range) {
  const days = RANGE_DAYS[range];
  if (!days) {
    const err = new Error(`Parameter 'range' tidak valid: "${range}"`);
    err.status = 400;
    throw err;
  }
  const granularity =
    range === "today" ? "hour" : range === "last_year" ? "month" : "day";

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const readings = await prisma.energyReading.findMany({
    where: { recordedAt: { gte: start, lte: end } },
    select: { recordedAt: true, usageKwh: true },
  });

  const buckets = new Map();
  for (const r of readings) {
    const key = bucketKey(r.recordedAt, granularity);
    buckets.set(key, (buckets.get(key) || 0) + (r.usageKwh || 0));
  }

  const points = [...buckets.entries()]
    .sort(([a], [b]) => (a > b ? 1 : -1))
    .map(([hour, kwh]) => ({ hour, kwh: Number(kwh.toFixed(3)) }));

  const values = points.map((p) => p.kwh);
  return {
    range,
    current: values[values.length - 1] || 0,
    peak: values.length ? Math.max(...values) : 0,
    average: values.length
      ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(3))
      : 0,
    points,
  };
}

async function getTopRiskyRooms(range) {
  const days = RANGE_DAYS[range];
  if (!days) {
    const err = new Error(`Parameter 'range' tidak valid: "${range}"`);
    err.status = 400;
    throw err;
  }
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const rooms = await prisma.room.findMany({ include: { devices: true } });

  const results = await Promise.all(
    rooms.map(async (room) => {
      if (room.devices.length === 0) return null;

      const perDevice = await Promise.all(
        room.devices.map(async (device) => {
          const agg = await prisma.energyReading.aggregate({
            where: {
              deviceId: device.id,
              recordedAt: { gte: start, lte: end },
            },
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

      const totalUsageKwh = perDevice.reduce((sum, d) => sum + d.totalKwh, 0);
      const avgUsageKwh = perDevice.length
        ? perDevice.reduce((sum, d) => sum + d.avgKwh, 0) / perDevice.length
        : 0;
      const peakUsageKwh = perDevice.reduce(
        (max, d) => Math.max(max, d.peakKwh),
        0,
      );
      const highest = perDevice.reduce(
        (best, d) => (d.totalKwh > (best?.totalKwh || 0) ? d : best),
        null,
      );

      return {
        id: room.id,
        name: room.name,
        location: room.location,
        highestComponent: highest?.name || "-",
        highestComponentKwh: Number((highest?.totalKwh || 0).toFixed(3)),
        peakUsageKwh: Number(peakUsageKwh.toFixed(3)),
        avgUsageKwh: Number(avgUsageKwh.toFixed(3)),
        totalUsageKwh: Number(totalUsageKwh.toFixed(3)),
      };
    }),
  );

  return results
    .filter(Boolean)
    .sort((a, b) => b.totalUsageKwh - a.totalUsageKwh)
    .slice(0, 5);
}

async function getActiveSchedules(status) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const where = { status: "active" };
  if (status === "upcoming") {
    where.repeatType = "none";
    where.scheduledDate = { gt: todayStart };
  } else {
    where.OR = [
      { repeatType: { not: "none" } },
      { scheduledDate: { lte: todayStart } },
    ];
  }

  const schedules = await prisma.schedule.findMany({
    where,
    include: { room: true, device: true },
    orderBy: { scheduledDate: "asc" },
    take: 20,
  });

  return schedules.map((s) => ({
    id: s.id,
    roomName: s.room.name,
    roomLocation: s.room.location,
    component: s.device?.name || "All devices",
    deviceEui: s.device?.eui || "-",
    startDate: s.scheduledDate,
    time: s.endTime ? `${s.startTime} - ${s.endTime}` : s.startTime,
    repeat: s.repeatType !== "none",
  }));
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

async function toXlsx(rows) {
  const workbook = new ExcelJS.workbook();
  const sheet = workbook.addWorksheet("Energy Report");
  sheet.columns = [
    { header: "Recorded At", key: "recordedAt", width: 24 },
    { header: "Room", key: "roomName", width: 20 },
    { header: "Device", key: "deviceName", width: 20 },
    { header: "Power (W)", key: "powerWatt", width: 14 },
    { header: "Usage (kWh)", key: "usageKwh", width: 14 },
  ];
  rows.forEach((r) => {
    sheet.addRow({
      recordedAt: r.recordedAt.toISOString(),
      roomName: r.roomName,
      deviceName: r.deviceName,
      powerWatt: r.powerWatt ?? "",
      usageKwh: r.usageKwh ?? "",
    });
  });

  return workbook.xlsx.writeBuffer();
}

async function toPdf(rows) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      margin: 30,
      size: "A4",
      layout: "landscape",
    });
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(14).text("Energy Usage Report", { align: "center" });
    doc.moveDown();

    const headers = [
      "Recorded At",
      "Room",
      "Device",
      "Power (W)",
      "Usage (kWh)",
    ];
    const widths = [150, 120, 120, 90, 90];
    const startX = doc.x;

    const drawRow = (values, bold = false) => {
      const y = doc.y;
      if (y > 520) {
        doc.addPage();
      }
      let x = startX;
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(9);
      values.forEach((v, i) => {
        doc.text(String(v), x, doc.y, { width: widths[i] });
        x += widths[i];
      });
      doc.moveDown(0.3);
    };

    drawRow(headers, true);
    rows.forEach((r) =>
      drawRow([
        r.recordedAt.toISOString(),
        r.roomName,
        r.deviceName,
        r.powerWatt ?? "-",
        r.usageKwh ?? "-",
      ]),
    );

    doc.end();
  });
}

module.exports = {
  getDeviceUsage,
  getRoomUsage,
  getDashboardSummary,
  exportEnergyReport,
  toCsv,
  toXlsx,
  toPdf,
  pruneOldReadings,
  getEnergyUsageTimeline,
  getTopRiskyRooms,
  getActiveSchedules,

  getRangeBounds,
  parseDateStrict,
  MAX_EXPORT_RANGE_DAYS,
};
