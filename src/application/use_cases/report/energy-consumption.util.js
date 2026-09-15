const { Prisma } = require("@prisma/client");
const { prisma } = require("../../../frameworks/database/prismaClient");

const LOOKBACK_MS = 24 * 60 * 60 * 1000;

/**
 * Bikin query SQL konsumsi per device per jam. usageKwh itu angka meter
 * kumulatif, jadi konsumsi = selisih tiap reading sama reading sebelumnya
 * Kalo selisihnya minus (meter reset/ganti), dianggep 0. Selisih
 * dicatet di jam reading yang lebih baru.
 *
 * Dipake di: getHourlyConsumption (file ini).
 */
function buildHourlyConsumptionQuery({ start, end, deviceIds }) {
  const lookbackStart = new Date(start.getTime() - LOOKBACK_MS);
  const deviceFilter = deviceIds
    ? Prisma.sql`AND "deviceId" IN (${Prisma.join(deviceIds)})`
    : Prisma.empty;

  return Prisma.sql`
    WITH ordered AS (
      SELECT
        "deviceId",
        "recordedAt",
        "usageKwh",
        LAG("usageKwh") OVER (PARTITION BY "deviceId" ORDER BY "recordedAt") AS "prevKwh"
      FROM "energy_readings"
      WHERE "recordedAt" >= ${lookbackStart}
        AND "recordedAt" <= ${end}
        AND "usageKwh" IS NOT NULL
        ${deviceFilter}
    )
    SELECT
      "deviceId",
      date_trunc('hour', "recordedAt") AS "hour",
      SUM(CASE WHEN "usageKwh" >= "prevKwh" THEN "usageKwh" - "prevKwh" ELSE 0 END)::float8 AS "kwh"
    FROM ordered
    WHERE "recordedAt" >= ${start} AND "prevKwh" IS NOT NULL
    GROUP BY 1, 2
    ORDER BY 2, 1
  `;
}

/**
 * Ambil konsumsi kWh per device per jam (jam UTC) di rentang start–end.
 * deviceIds opsional; kalo dikasih array kosong langsung balikin [] tanpa
 * query. Hasil: [{ deviceId, hour: Date, kwh }].
 *
 * Dipake di: report.usecase.js → getReportSummary, getDeviceUsage,
 *   getRoomUsage, getDashboardSummary, getEnergyUsageTimeline,
 *   getTopRiskyRooms; room.usecase.js → getUsage24hByDevice,
 *   computeRoomUsage.
 */
async function getHourlyConsumption({ start, end, deviceIds } = {}) {
  if (Array.isArray(deviceIds) && deviceIds.length === 0) return [];

  const rows = await prisma.$queryRaw(
    buildHourlyConsumptionQuery({ start, end, deviceIds }),
  );

  return rows.map((row) => ({
    deviceId: row.deviceId,
    hour: new Date(row.hour),
    kwh: Number(row.kwh) || 0,
  }));
}

/**
 * Jumlahin kWh semua baris konsumsi.
 *
 * Dipake di: report.usecase.js → getDeviceUsage, getDashboardSummary.
 */
function sumKwh(rows) {
  return rows.reduce((total, row) => total + row.kwh, 0);
}

/**
 * Jumlahin kWh per device. Hasil: Map deviceId → kWh.
 *
 * Dipake di: report.usecase.js → getReportSummary, getRoomUsage,
 *   getTopRiskyRooms; room.usecase.js → getUsage24hByDevice,
 *   computeRoomUsage.
 */
function sumKwhByDevice(rows) {
  const totals = new Map();
  for (const row of rows) {
    totals.set(row.deviceId, (totals.get(row.deviceId) || 0) + row.kwh);
  }
  return totals;
}

/**
 * Konsumsi jam paling tinggi (semua device di rows dijumlahin per jam dulu).
 * Balikin 0 kalo kosong.
 *
 * Dipake di: report.usecase.js → getTopRiskyRooms; room.usecase.js →
 *   computeRoomUsage.
 */
function peakHourlyKwh(rows) {
  const perHour = new Map();
  for (const row of rows) {
    const key = row.hour.getTime();
    perHour.set(key, (perHour.get(key) || 0) + row.kwh);
  }
  return perHour.size ? Math.max(...perHour.values()) : 0;
}

module.exports = {
  LOOKBACK_MS,
  buildHourlyConsumptionQuery,
  getHourlyConsumption,
  sumKwh,
  sumKwhByDevice,
  peakHourlyKwh,
};
