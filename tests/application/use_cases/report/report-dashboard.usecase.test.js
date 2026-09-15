const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const report = require("../../../../src/application/use_cases/report/report.usecase");
const { resetPrismaMock } = require("../../../helpers/prisma");

const NOW = new Date("2026-09-14T10:00:00+07:00");

beforeEach(() => {
  resetPrismaMock(prisma);
  jest.useFakeTimers({
    now: NOW,
    doNotFake: ["nextTick", "setImmediate", "setTimeout", "setInterval", "queueMicrotask"],
  });
});

afterEach(() => jest.useRealTimers());

describe("getReportSummary", () => {
  test("[positive] pemakaian dari selisih meter (tahan meter reset, bukan max-min), diurutkan dari terbesar", async () => {
    prisma.energyReading.groupBy.mockResolvedValue([
      { deviceId: "d1", _min: { usageKwh: 100, recordedAt: new Date("2026-09-01") }, _max: { usageKwh: 101.2345, recordedAt: new Date("2026-09-10") } },
      // meter d2 sempat reset: max-min = 249,9 padahal konsumsinya 20
      { deviceId: "d2", _min: { usageKwh: 0.1, recordedAt: new Date("2026-09-01") }, _max: { usageKwh: 250, recordedAt: new Date("2026-09-10") } },
    ]);
    prisma.$queryRaw.mockResolvedValue([
      { deviceId: "d1", hour: new Date("2026-09-02T01:00:00Z"), kwh: 1.234 },
      { deviceId: "d2", hour: new Date("2026-09-02T01:00:00Z"), kwh: 12 },
      { deviceId: "d2", hour: new Date("2026-09-03T01:00:00Z"), kwh: 8 },
    ]);
    prisma.device.findMany.mockResolvedValue([
      { id: "d1", eui: "E1", name: "AC", room: { name: "Server", location: "Lt 1" } },
      { id: "d2", eui: "E2", name: "Lampu", room: { name: "Lobby", location: null } },
    ]);

    const rows = await report.getReportSummary({ from: "2026-09-01", to: "2026-09-10" });

    expect(rows.map((r) => r.key)).toEqual(["d2", "d1"]);
    expect(rows[0]).toMatchObject({ deviceName: "Lampu", roomName: "Lobby", startUsageKwh: 0.1, endUsageKwh: 250, usageKwh: 20 });
    expect(rows[1].usageKwh).toBe(1.234);
    expect(prisma.$queryRaw.mock.calls[0][0].values).toEqual(expect.arrayContaining(["d1", "d2"]));
  });

  test("[positive] filter roomId & deviceId diteruskan ke query", async () => {
    prisma.room.findUnique.mockResolvedValue({ id: "r1" });
    prisma.device.findUnique.mockResolvedValue({ id: "d1" });
    prisma.energyReading.groupBy.mockResolvedValue([]);

    await report.getReportSummary({ roomId: "r1", deviceId: "d1", from: "2026-09-01", to: "2026-09-01" });

    const where = prisma.energyReading.groupBy.mock.calls[0][0].where;
    expect(where.device).toEqual({ roomId: "r1", id: "d1" });
    expect(where.recordedAt.lte.getHours()).toBe(23);
  });

  test("[negative] tidak ada data -> array kosong tanpa query device", async () => {
    prisma.energyReading.groupBy.mockResolvedValue([]);
    await expect(report.getReportSummary({ from: "2026-09-01", to: "2026-09-02" })).resolves.toEqual([]);
    expect(prisma.device.findMany).not.toHaveBeenCalled();
  });

  test("[negative] device sudah terhapus -> label '-'", async () => {
    prisma.energyReading.groupBy.mockResolvedValue([
      { deviceId: "ghost", _min: { usageKwh: null, recordedAt: null }, _max: { usageKwh: null, recordedAt: null } },
    ]);
    prisma.device.findMany.mockResolvedValue([]);
    prisma.$queryRaw.mockResolvedValue([]);
    const [row] = await report.getReportSummary({ from: "2026-09-01", to: "2026-09-02" });
    expect(row).toMatchObject({ deviceEui: "-", deviceName: "-", roomName: "-", usageKwh: 0 });
  });

  test.each([
    [{ from: undefined, to: "2026-09-01" }, 400],
    [{ from: "2026-09-05", to: "2026-09-01" }, 400],
    [{ from: "2025-01-01", to: "2026-09-01" }, 400],
    [{ from: "2026-13-01", to: "2026-09-01" }, 400],
  ])("[negative] parameter tanggal tidak valid %j -> %i", async (params, status) => {
    await expect(report.getReportSummary(params)).rejects.toMatchObject({ status });
  });

  test("[negative] roomId / deviceId tidak ditemukan -> 404", async () => {
    prisma.room.findUnique.mockResolvedValue(null);
    await expect(
      report.getReportSummary({ roomId: "x", from: "2026-09-01", to: "2026-09-02" }),
    ).rejects.toMatchObject({ status: 404 });

    prisma.device.findUnique.mockResolvedValue(null);
    await expect(
      report.getReportSummary({ deviceId: "x", from: "2026-09-01", to: "2026-09-02" }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("getRoomUsage", () => {
  test("[positive] total pemakaian semua device di room", async () => {
    prisma.room.findUnique.mockResolvedValue({ id: "r1", name: "Server", devices: [{ id: "d1", name: "AC" }, { id: "d2", name: "UPS" }] });
    prisma.$queryRaw.mockResolvedValue([{ deviceId: "d1", hour: new Date("2026-09-13T01:00:00Z"), kwh: 2 }]);

    const result = await report.getRoomUsage("r1", "week");
    expect(result.totalUsageKwh).toBe(2);
    expect(result.devices).toEqual([
      { deviceId: "d1", deviceName: "AC", usageKwh: 2 },
      { deviceId: "d2", deviceName: "UPS", usageKwh: 0 },
    ]);
  });

  test("[positive] room tanpa device -> total 0 tanpa query reading", async () => {
    prisma.room.findUnique.mockResolvedValue({ id: "r1", name: "Kosong", devices: [] });
    const result = await report.getRoomUsage("r1", "today");
    expect(result).toMatchObject({ totalUsageKwh: 0, devices: [] });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  test("[negative] room tidak ditemukan -> 404, range tidak valid -> 400", async () => {
    prisma.room.findUnique.mockResolvedValue(null);
    await expect(report.getRoomUsage("x", "today")).rejects.toMatchObject({ status: 404 });
    prisma.room.findUnique.mockResolvedValue({ id: "r1", devices: [] });
    await expect(report.getRoomUsage("r1", "year")).rejects.toMatchObject({ status: 400 });
  });
});

describe("getDashboardSummary", () => {
  function mockCounts({ today = 12, yesterday = 10, devices } = {}) {
    prisma.device.count.mockResolvedValue(3);
    prisma.device.findMany.mockResolvedValue(
      devices ?? [
        { lastSeenAt: new Date(NOW.getTime() - 10 * 60000), intervalMinutes: 15 },
        { lastSeenAt: new Date(NOW.getTime() - 60 * 60000), intervalMinutes: 15 },
        { lastSeenAt: null, intervalMinutes: 15 },
      ],
    );
    prisma.gateway.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);
    // Hari ini mulai 2026-09-14 00:00 WIB = 2026-09-13T17:00Z
    prisma.$queryRaw.mockResolvedValue([
      ...(today == null ? [] : [{ deviceId: "d1", hour: new Date("2026-09-14T02:00:00Z"), kwh: today }]),
      ...(yesterday == null ? [] : [{ deviceId: "d1", hour: new Date("2026-09-13T03:00:00Z"), kwh: yesterday }]),
    ]);
  }

  test("[positive] ringkasan energi, gateway, device online/offline", async () => {
    mockCounts();
    await expect(report.getDashboardSummary()).resolves.toEqual({
      energyUsage: { totalKwh: 12, changePercentFromYesterday: 20 },
      gateways: { total: 2, online: 1, offline: 1 },
      devices: { total: 3, online: 1, offline: 2 },
    });
  });

  test("[negative] kemarin 0 kWh -> persen perubahan 0 (tidak Infinity/NaN)", async () => {
    mockCounts({ today: 5, yesterday: 0 });
    const result = await report.getDashboardSummary();
    expect(result.energyUsage.changePercentFromYesterday).toBe(0);
  });

  test("[edge] konsumsi jam 00:00 WIB masuk hari ini, jam 23:00 WIB masuk kemarin", async () => {
    mockCounts();
    prisma.$queryRaw.mockResolvedValue([
      { deviceId: "d1", hour: new Date("2026-09-13T17:00:00Z"), kwh: 3 },
      { deviceId: "d1", hour: new Date("2026-09-13T16:00:00Z"), kwh: 2 },
    ]);
    const result = await report.getDashboardSummary();
    expect(result.energyUsage).toEqual({ totalKwh: 3, changePercentFromYesterday: 50 });
  });

  test("[negative] tidak ada reading sama sekali -> total 0", async () => {
    mockCounts({ today: null, yesterday: null });
    const result = await report.getDashboardSummary();
    expect(result.energyUsage).toEqual({ totalKwh: 0, changePercentFromYesterday: 0 });
  });
});

describe("getEnergyUsageTimeline", () => {
  test("[positive] 'today' dikelompokkan per jam & statistik dihitung", async () => {
    prisma.$queryRaw.mockResolvedValue([
      { deviceId: "d1", hour: new Date("2026-09-14T08:00:00+07:00"), kwh: 1 },
      { deviceId: "d2", hour: new Date("2026-09-14T08:00:00+07:00"), kwh: 2 },
      { deviceId: "d1", hour: new Date("2026-09-14T09:00:00+07:00"), kwh: 4 },
    ]);
    await expect(report.getEnergyUsageTimeline("today")).resolves.toEqual({
      range: "today",
      current: 4,
      peak: 4,
      average: 3.5,
      points: [
        { hour: "08.00", kwh: 3 },
        { hour: "09.00", kwh: 4 },
      ],
    });
  });

  test("[positive] 'last_year' per bulan, 'last_week' per hari", async () => {
    prisma.$queryRaw.mockResolvedValue([
      { deviceId: "d1", hour: new Date("2026-08-01T12:00:00+07:00"), kwh: 1 },
    ]);
    expect((await report.getEnergyUsageTimeline("last_year")).points[0].hour).toBe("2026-08");
    expect((await report.getEnergyUsageTimeline("last_week")).points[0].hour).toBe("2026-08-01");
  });

  test("[negative] tanpa data -> semua 0 & points kosong", async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await expect(report.getEnergyUsageTimeline("last_month")).resolves.toEqual({
      range: "last_month",
      current: 0,
      peak: 0,
      average: 0,
      points: [],
    });
  });

  test("[negative] range tidak dikenal -> 400", async () => {
    await expect(report.getEnergyUsageTimeline("week")).rejects.toMatchObject({ status: 400 });
  });

  // usageKwh itu angka meter kumulatif (meter_reading/1000). Dulu reading 205,0 + 205,5
  // dijumlahin jadi 410,5 kWh; sekarang yang dipake konsumsi (selisih meter) dari SQL.
  test("[positive] konsumsi per jam dari selisih meter, angka meter mentah nggak dijumlahin", async () => {
    prisma.$queryRaw.mockResolvedValue([
      { deviceId: "d1", hour: new Date("2026-09-14T08:00:00+07:00"), kwh: 0.5 },
    ]);
    const { points } = await report.getEnergyUsageTimeline("today");
    expect(points).toEqual([{ hour: "08.00", kwh: 0.5 }]);
    expect(prisma.energyReading.findMany).not.toHaveBeenCalled();
    expect(prisma.$queryRaw.mock.calls[0][0].text).not.toContain('"deviceId" IN');
  });
});

describe("getTopRiskyRooms", () => {
  test("[positive] maksimal 5 room, urut total terbesar, room tanpa device diabaikan", async () => {
    const rooms = Array.from({ length: 7 }, (_, i) => ({
      id: `r${i}`,
      name: `Room ${i}`,
      location: "L",
      devices: i === 6 ? [] : [{ id: `d${i}`, name: `Dev ${i}` }],
    }));
    prisma.room.findMany.mockResolvedValue(rooms);
    prisma.$queryRaw.mockResolvedValue(
      Array.from({ length: 6 }, (_, n) => [
        { deviceId: `d${n}`, hour: new Date("2026-09-10T01:00:00Z"), kwh: n * 4 },
        { deviceId: `d${n}`, hour: new Date("2026-09-10T02:00:00Z"), kwh: n * 6 },
      ]).flat(),
    );

    const result = await report.getTopRiskyRooms("last_week");
    expect(result.map((r) => r.id)).toEqual(["r5", "r4", "r3", "r2", "r1"]);
    expect(result[0]).toMatchObject({
      highestComponent: "Dev 5",
      highestComponentKwh: 50,
      peakUsageKwh: 30,
      avgUsageKwh: 0.298, // 50 kWh / (7 × 24 jam)
      totalUsageKwh: 50,
    });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.energyReading.aggregate).not.toHaveBeenCalled();
  });

  test("[positive] puncak room = jam dengan jumlah semua device-nya paling gede", async () => {
    prisma.room.findMany.mockResolvedValue([
      { id: "r1", name: "R", location: "L", devices: [{ id: "a", name: "AC" }, { id: "b", name: "UPS" }] },
    ]);
    prisma.$queryRaw.mockResolvedValue([
      { deviceId: "a", hour: new Date("2026-09-14T01:00:00Z"), kwh: 1 },
      { deviceId: "b", hour: new Date("2026-09-14T01:00:00Z"), kwh: 2 },
      { deviceId: "a", hour: new Date("2026-09-14T02:00:00Z"), kwh: 2.5 },
    ]);
    const [room] = await report.getTopRiskyRooms("today");
    expect(room).toMatchObject({ highestComponent: "AC", highestComponentKwh: 3.5, peakUsageKwh: 3, totalUsageKwh: 5.5 });
  });

  test("[negative] semua pemakaian 0 -> highestComponent '-'", async () => {
    prisma.room.findMany.mockResolvedValue([{ id: "r1", name: "R", location: "L", devices: [{ id: "d1", name: "A" }] }]);
    prisma.$queryRaw.mockResolvedValue([]);
    const [room] = await report.getTopRiskyRooms("today");
    expect(room).toMatchObject({ highestComponent: "-", totalUsageKwh: 0 });
  });

  test("[negative] range tidak dikenal -> 400", async () => {
    await expect(report.getTopRiskyRooms("forever")).rejects.toMatchObject({ status: 400 });
  });
});

describe("getActiveSchedules", () => {
  const schedule = {
    id: "s1",
    room: { name: "Server", location: "Lt 1" },
    device: null,
    scheduledDate: new Date("2026-09-14"),
    startTime: "08:00",
    endTime: "17:00",
    repeatType: "daily",
  };

  test("[positive] status 'active' -> recurring atau sudah mulai, mapping 'All devices'", async () => {
    prisma.schedule.findMany.mockResolvedValue([schedule]);
    const [row] = await report.getActiveSchedules("active");

    const { where, take } = prisma.schedule.findMany.mock.calls[0][0];
    expect(where.status).toBe("active");
    expect(where.OR).toHaveLength(2);
    expect(take).toBe(20);
    expect(row).toMatchObject({ component: "All devices", deviceEui: "-", time: "08:00 - 17:00", repeat: true });
  });

  test("[positive] status 'upcoming' -> hanya one-time di masa depan", async () => {
    prisma.schedule.findMany.mockResolvedValue([
      { ...schedule, device: { name: "AC", eui: "E1" }, endTime: null, repeatType: "none" },
    ]);
    const [row] = await report.getActiveSchedules("upcoming");
    const { where } = prisma.schedule.findMany.mock.calls[0][0];
    expect(where.repeatType).toBe("none");
    expect(where.scheduledDate.gt).toBeInstanceOf(Date);
    expect(row).toMatchObject({ component: "AC", deviceEui: "E1", time: "08:00", repeat: false });
  });

  test("[negative] status tidak dikenal diperlakukan sebagai 'active'", async () => {
    prisma.schedule.findMany.mockResolvedValue([]);
    await report.getActiveSchedules("whatever");
    expect(prisma.schedule.findMany.mock.calls[0][0].where.OR).toBeDefined();
  });
});

describe("pruneOldReadings", () => {
  test("[positive] hapus reading lebih lama dari ENERGY_RETENTION_DAYS", async () => {
    prisma.energyReading.deleteMany.mockResolvedValue({ count: 42 });
    const { deletedCount, cutoff } = await report.pruneOldReadings();
    expect(deletedCount).toBe(42);
    const expected = new Date(NOW);
    expected.setDate(expected.getDate() - 90);
    expect(cutoff.getTime()).toBe(expected.getTime());
    expect(prisma.energyReading.deleteMany).toHaveBeenCalledWith({ where: { recordedAt: { lt: cutoff } } });
  });

  test("[negative] tidak ada yang dihapus -> 0", async () => {
    prisma.energyReading.deleteMany.mockResolvedValue({ count: 0 });
    expect((await report.pruneOldReadings()).deletedCount).toBe(0);
  });
});

describe("toXlsx & toPdf", () => {
  const rows = [
    { recordedAt: new Date("2026-09-14T03:00:00Z"), roomName: "Server", deviceName: "AC", powerWatt: null, usageKwh: 1.5 },
  ];

  test("[positive] xlsx menghasilkan buffer zip (header 'PK')", async () => {
    const buffer = Buffer.from(await report.toXlsx(rows));
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });

  test("[positive] pdf menghasilkan dokumen PDF valid, termasuk data kosong", async () => {
    const pdf = await report.toPdf(rows);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
    const empty = await report.toPdf([]);
    expect(empty.subarray(0, 4).toString()).toBe("%PDF");
  });

  test("[positive] pdf dengan banyak baris tetap selesai (pindah halaman)", async () => {
    const many = Array.from({ length: 200 }, () => rows[0]);
    const pdf = await report.toPdf(many);
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
