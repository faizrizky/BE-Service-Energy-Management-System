jest.mock("../../../../src/frameworks/database/prismaClient", () => ({
  prisma: {
    room: { findUnique: jest.fn(), count: jest.fn() },
    device: { findUnique: jest.fn(), count: jest.fn() },
    gateway: { count: jest.fn() },
    schedule: { count: jest.fn() },
    energyReading: {
      aggregate: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const reportUseCase = require("../../../../src/application/use_cases/report/report.usecase");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("parseDateStrict", () => {
  test("tanggal valid ke-parse dengan benar", () => {
    const date = reportUseCase.parseDateStrict("2026-08-23", "from");
    expect(date.getUTCFullYear()).toBe(2026);
  });

  test("[negative] value kosong/undefined -> 400", () => {
    expect(() => reportUseCase.parseDateStrict(undefined, "from")).toThrow(
      /wajib diisi/,
    );
    expect(() => reportUseCase.parseDateStrict("", "from")).toThrow(
      /wajib diisi/,
    );
  });

  test("[negative] format salah (bukan YYYY-MM-DD) -> 400", () => {
    expect(() => reportUseCase.parseDateStrict("23-08-2026", "from")).toThrow(
      /format YYYY-MM-DD/,
    );
    expect(() => reportUseCase.parseDateStrict("2026/08/23", "from")).toThrow(
      /format YYYY-MM-DD/,
    );
    expect(() =>
      reportUseCase.parseDateStrict("Agustus 23 2026", "from"),
    ).toThrow(/format YYYY-MM-DD/);
  });

  test("[negative] format bener tapi tanggal gak valid secara kalender -> 400", () => {
    // 30 Februari gak pernah ada
    expect(() => reportUseCase.parseDateStrict("2026-02-30", "from")).toThrow(
      /bukan tanggal yang valid/,
    );
  });

  test("[negative - injeksi/tipe aneh] value bukan string", () => {
    expect(() => reportUseCase.parseDateStrict(20260823, "from")).toThrow();
    expect(() => reportUseCase.parseDateStrict({}, "from")).toThrow();
    expect(() => reportUseCase.parseDateStrict(null, "from")).toThrow(
      /wajib diisi/,
    );
  });
});

describe("getRangeBounds", () => {
  test("range 'today' -> start jam 00:00 hari ini", () => {
    const { start, end } = reportUseCase.getRangeBounds("today");
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(end.getTime()).toBeGreaterThanOrEqual(start.getTime());
  });

  test("range 'week' -> start ~7 hari ke belakang", () => {
    const { start, end } = reportUseCase.getRangeBounds("week");
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(7, 0);
  });

  test("range 'month' -> start ~30 hari ke belakang", () => {
    const { start, end } = reportUseCase.getRangeBounds("month");
    const diffDays = (end - start) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeCloseTo(30, 0);
  });

  test("[negative] range gak dikenal -> 400", () => {
    expect(() => reportUseCase.getRangeBounds("yearly")).toThrow(/tidak valid/);
    expect(() => reportUseCase.getRangeBounds("")).toThrow(/tidak valid/);
    expect(() => reportUseCase.getRangeBounds(undefined)).toThrow(
      /tidak valid/,
    );
  });

  test("[negative - tidak mungkin lewat query string normal] range berupa angka/object", () => {
    expect(() => reportUseCase.getRangeBounds(123)).toThrow();
    expect(() => reportUseCase.getRangeBounds({})).toThrow();
  });
});

describe("getDeviceUsage", () => {
  test("[negative] device gak ketemu -> 404", async () => {
    prisma.device.findUnique.mockResolvedValue(null);
    await expect(
      reportUseCase.getDeviceUsage("id-gak-ada", "today"),
    ).rejects.toThrow("Device tidak ditemukan");
  });

  test("device valid, gak ada reading sama sekali -> total 0 (bukan null/undefined)", async () => {
    prisma.device.findUnique.mockResolvedValue({ id: "d1", name: "AC 1" });
    prisma.energyReading.aggregate.mockResolvedValue({
      _sum: { usageKwh: null },
      _avg: { powerWatt: null },
      _count: 0,
    });

    const result = await reportUseCase.getDeviceUsage("d1", "today");
    expect(result.totalUsageKwh).toBe(0);
    expect(result.avgPowerWatt).toBe(0);
    expect(result.readingCount).toBe(0);
  });

  test("[negative] range invalid dilempar dari sini juga (gak divalidasi ulang di controller)", async () => {
    prisma.device.findUnique.mockResolvedValue({ id: "d1", name: "AC 1" });
    await expect(
      reportUseCase.getDeviceUsage("d1", "invalid-range"),
    ).rejects.toThrow(/tidak valid/);
  });
});

describe("exportEnergyReport", () => {
  test("[negative] from/to kosong -> 400", async () => {
    await expect(reportUseCase.exportEnergyReport({})).rejects.toThrow(
      /wajib diisi/,
    );
  });

  test("[negative] from > to -> 400", async () => {
    await expect(
      reportUseCase.exportEnergyReport({
        from: "2026-08-23",
        to: "2026-08-01",
      }),
    ).rejects.toThrow(/tidak boleh lebih besar/);
  });

  test("[negative] rentang melebihi MAX_EXPORT_RANGE_DAYS -> 400", async () => {
    await expect(
      reportUseCase.exportEnergyReport({
        from: "2020-01-01",
        to: "2026-08-23",
      }),
    ).rejects.toThrow(/terlalu panjang/);
  });

  test("[negative] roomId dikasih tapi gak ketemu -> 404", async () => {
    prisma.room.findUnique.mockResolvedValue(null);
    await expect(
      reportUseCase.exportEnergyReport({
        from: "2026-08-01",
        to: "2026-08-23",
        roomId: "room-hantu",
      }),
    ).rejects.toThrow(/Room dengan id/);
  });

  test("[negative] deviceId dikasih tapi gak ketemu -> 404", async () => {
    prisma.device.findUnique.mockResolvedValue(null);
    await expect(
      reportUseCase.exportEnergyReport({
        from: "2026-08-01",
        to: "2026-08-23",
        deviceId: "device-hantu",
      }),
    ).rejects.toThrow(/Device dengan id/);
  });

  test("kasus normal, mapping data readings ke bentuk export", async () => {
    prisma.energyReading.findMany.mockResolvedValue([
      {
        recordedAt: new Date("2026-08-10T10:00:00Z"),
        powerWatt: 120,
        usageKwh: 0.02,
        device: { name: "AC 1", room: { name: "Ruang Server" } },
      },
    ]);

    const rows = await reportUseCase.exportEnergyReport({
      from: "2026-08-01",
      to: "2026-08-23",
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].roomName).toBe("Ruang Server");
    expect(rows[0].deviceName).toBe("AC 1");
  });

  test("[negative] reading dengan relasi device/room null (data korup/orphan) -> fallback '-'", async () => {
    prisma.energyReading.findMany.mockResolvedValue([
      {
        recordedAt: new Date("2026-08-10T10:00:00Z"),
        powerWatt: 100,
        usageKwh: 0.01,
        device: null,
      },
    ]);

    const rows = await reportUseCase.exportEnergyReport({
      from: "2026-08-01",
      to: "2026-08-23",
    });
    expect(rows[0].roomName).toBe("-");
    expect(rows[0].deviceName).toBe("-");
  });
});

describe("toCsv", () => {
  test("array kosong -> cuma header", () => {
    const csv = reportUseCase.toCsv([]);
    expect(csv).toBe("recordedAt,roomName,deviceName,powerWatt,usageKwh");
  });

  test("format baris sesuai urutan kolom", () => {
    const csv = reportUseCase.toCsv([
      {
        recordedAt: new Date("2026-08-10T10:00:00.000Z"),
        roomName: "R1",
        deviceName: "D1",
        powerWatt: 100,
        usageKwh: 0.5,
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[1]).toBe('2026-08-10T10:00:00.000Z,"R1","D1",100,0.5');
  });

  test("[negative - known limitation] nama room/device yang mengandung koma bikin kolom CSV geser", () => {
    const csv = reportUseCase.toCsv([
      {
        recordedAt: new Date("2026-08-10T10:00:00.000Z"),
        roomName: "Ruang Rapat, Lt 2",
        deviceName: "AC",
        powerWatt: 1,
        usageKwh: 1,
      },
    ]);

    expect(csv).toContain('"Ruang Rapat, Lt 2"');
  });

  test("[negative] powerWatt/usageKwh null -> tetap string kosong, gak 'null' literal", () => {
    const csv = reportUseCase.toCsv([
      {
        recordedAt: new Date("2026-08-10T10:00:00.000Z"),
        roomName: "R1",
        deviceName: "D1",
        powerWatt: null,
        usageKwh: null,
      },
    ]);
    expect(csv.split("\n")[1]).toBe('2026-08-10T10:00:00.000Z,"R1","D1",,');
  });
});
