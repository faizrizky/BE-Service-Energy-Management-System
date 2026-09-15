const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const {
  LOOKBACK_MS,
  buildHourlyConsumptionQuery,
  getHourlyConsumption,
  sumKwh,
  sumKwhByDevice,
  peakHourlyKwh,
} = require("../../../../src/application/use_cases/report/energy-consumption.util");
const { resetPrismaMock } = require("../../../helpers/prisma");

const start = new Date("2026-09-14T00:00:00.000Z");
const end = new Date("2026-09-14T03:00:00.000Z");
const hour = (h) => new Date(`2026-09-14T0${h}:00:00.000Z`);

beforeEach(() => resetPrismaMock(prisma));

describe("buildHourlyConsumptionQuery", () => {
  test("[positive] pake LAG per device (selisih meter) & minus dianggap 0", () => {
    const { text } = buildHourlyConsumptionQuery({ start, end });
    expect(text).toContain('LAG("usageKwh") OVER (PARTITION BY "deviceId" ORDER BY "recordedAt")');
    expect(text).toContain('CASE WHEN "usageKwh" >= "prevKwh" THEN "usageKwh" - "prevKwh" ELSE 0 END');
    expect(text).toContain("date_trunc('hour', \"recordedAt\")");
  });

  test("[positive] reading sebelum rentang ikut diambil (lookback) tapi hasil dipotong dari start", () => {
    const { values } = buildHourlyConsumptionQuery({ start, end });
    expect(values).toEqual([new Date(start.getTime() - LOOKBACK_MS), end, start]);
  });

  test("[positive] deviceIds jadi filter IN pake parameter (bukan string mentah)", () => {
    const { text, values } = buildHourlyConsumptionQuery({ start, end, deviceIds: ["d1", "d2'; DROP TABLE x;--"] });
    expect(text).toContain('AND "deviceId" IN ($3,$4)');
    expect(values).toContain("d2'; DROP TABLE x;--");
  });

  test("[negative] tanpa deviceIds -> nggak ada filter device", () => {
    expect(buildHourlyConsumptionQuery({ start, end }).text).not.toContain('"deviceId" IN');
  });
});

describe("getHourlyConsumption", () => {
  test("[positive] hasil query dirapihin jadi { deviceId, hour: Date, kwh: number }", async () => {
    prisma.$queryRaw.mockResolvedValue([
      { deviceId: "d1", hour: "2026-09-14T00:00:00.000Z", kwh: 0.5 },
      { deviceId: "d2", hour: hour(1), kwh: "1.25" },
    ]);
    await expect(getHourlyConsumption({ start, end, deviceIds: ["d1", "d2"] })).resolves.toEqual([
      { deviceId: "d1", hour: hour(0), kwh: 0.5 },
      { deviceId: "d2", hour: hour(1), kwh: 1.25 },
    ]);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  test("[negative] deviceIds kosong -> [] tanpa query", async () => {
    await expect(getHourlyConsumption({ start, end, deviceIds: [] })).resolves.toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test("[negative] kwh null/nggak valid -> 0", async () => {
    prisma.$queryRaw.mockResolvedValue([{ deviceId: "d1", hour: hour(0), kwh: null }]);
    const [row] = await getHourlyConsumption({ start, end });
    expect(row.kwh).toBe(0);
  });
});

describe("sumKwh, sumKwhByDevice, peakHourlyKwh", () => {
  const rows = [
    { deviceId: "d1", hour: hour(0), kwh: 0.5 },
    { deviceId: "d2", hour: hour(0), kwh: 1 },
    { deviceId: "d1", hour: hour(1), kwh: 0.8 },
    { deviceId: "d1", hour: hour(2), kwh: 0.5 },
  ];

  test("[positive] total semua baris", () => {
    expect(sumKwh(rows)).toBeCloseTo(2.8);
  });

  test("[positive] total per device", () => {
    const totals = sumKwhByDevice(rows);
    expect(totals.get("d1")).toBeCloseTo(1.8);
    expect(totals.get("d2")).toBe(1);
  });

  test("[positive] puncak = jam dengan jumlah semua device paling gede", () => {
    expect(peakHourlyKwh(rows)).toBeCloseTo(1.5);
  });

  test("[negative] kosong -> 0 / Map kosong", () => {
    expect(sumKwh([])).toBe(0);
    expect(sumKwhByDevice([]).size).toBe(0);
    expect(peakHourlyKwh([])).toBe(0);
  });
});
