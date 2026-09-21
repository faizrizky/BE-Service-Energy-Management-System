jest.mock("../../../../src/application/use_cases/device/device.usecase", () => ({
  requestRelayCommand: jest.fn(),
  getPendingCommandsByDevice: jest.fn(),
}));
jest.mock("../../../../src/frameworks/webserver/socket-events", () => ({
  emitRoomCreated: jest.fn(),
  emitRoomUpdated: jest.fn(),
  emitRoomDeleted: jest.fn(),
  emitRoomPower: jest.fn(),
}));

const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const deviceUseCase = require("../../../../src/application/use_cases/device/device.usecase");
const events = require("../../../../src/frameworks/webserver/socket-events");
const roomUseCase = require("../../../../src/application/use_cases/room/room.usecase");
const { resetPrismaMock } = require("../../../helpers/prisma");

const minutesAgo = (m) => new Date(Date.now() - m * 60000);

function device(overrides = {}) {
  return {
    id: "d1",
    name: "AC",
    eui: "08000000410000e4",
    deviceType: "AC",
    status: "off",
    intervalMinutes: 15,
    lastSeenAt: minutesAgo(5),
    gatewayId: "g1",
    roomId: "r1",
    ...overrides,
  };
}

/** energyReading.findFirst: desc = reading terbaru, asc = reading terlama. */
// Konsumsi dihitung di SQL (selisih meter). Mock-nya balikin satu baris per
// device yang diminta: kwh = angka meter terbaru - paling lama.
function mockReadings(byDevice) {
  prisma.$queryRaw.mockImplementation(async (query) =>
    query.values
      .filter((value) => typeof value === "string" && byDevice[value])
      .map((deviceId) => ({
        deviceId,
        hour: new Date(),
        kwh: byDevice[deviceId].latest - byDevice[deviceId].earliest,
      })),
  );
}

beforeEach(() => {
  resetPrismaMock(prisma);
  jest.clearAllMocks();
  deviceUseCase.getPendingCommandsByDevice.mockResolvedValue(new Map());
});

describe("listRoomsPaginated", () => {
  test("[positive] agregasi online/offline, pemakaian 24 jam, power & jumlah perintah pending", async () => {
    prisma.room.count.mockResolvedValue(1);
    prisma.room.findMany.mockResolvedValue([
      {
        id: "r1",
        name: "Server",
        location: "Lt 1",
        isCritical: true,
        devices: [
          device({ id: "d1", status: "on" }),
          device({ id: "d2", lastSeenAt: minutesAgo(31) }),
          device({ id: "d3", lastSeenAt: null }),
        ],
      },
    ]);
    mockReadings({ d1: { latest: 205.9, earliest: 205.0 }, d2: { latest: 10, earliest: 10 } });
    deviceUseCase.getPendingCommandsByDevice.mockResolvedValue(new Map([["d2", {}]]));

    const result = await roomUseCase.listRoomsPaginated();

    expect(deviceUseCase.getPendingCommandsByDevice).toHaveBeenCalledWith(["d1", "d2", "d3"]);
    expect(result.data[0]).toMatchObject({
      id: "r1",
      name: "Server",
      location: "Lt 1",
      gatewayId: "g1",
      devicesOnline: 1,
      devicesOffline: 2,
      totalUsage24hKwh: 0.9,
      pendingResync: null,
      isPowerOn: true,
      pendingCommandCount: 1,
      isCritical: true,
    });
  });

  test("[negative] room tanpa device -> gatewayId null, 0 online, power off", async () => {
    prisma.room.count.mockResolvedValue(1);
    prisma.room.findMany.mockResolvedValue([{ id: "r1", name: "Kosong", devices: [], isCritical: false }]);
    const [room] = (await roomUseCase.listRoomsPaginated()).data;
    expect(room).toMatchObject({ gatewayId: null, devicesOnline: 0, devicesOffline: 0, isPowerOn: false, pendingCommandCount: 0, totalUsage24hKwh: 0 });
  });

  // Meter reset (500 -> 1) ditangani di SQL: selisih minus dianggap 0, tapi konsumsi
  // sebelum & sesudah reset tetep dihitung (dulu terbaru - terlama dipotong jadi 0).
  test("[negative] meter reset -> konsumsi sebelum & sesudah reset tetep dihitung, nggak minus", async () => {
    prisma.room.count.mockResolvedValue(1);
    prisma.room.findMany.mockResolvedValue([{ id: "r1", devices: [device()] }]);
    prisma.$queryRaw.mockResolvedValue([
      { deviceId: "d1", hour: minutesAgo(120), kwh: 0.4 },
      { deviceId: "d1", hour: minutesAgo(60), kwh: 0.6 },
    ]);
    const result = await roomUseCase.listRoomsPaginated();
    expect(result.data[0].totalUsage24hKwh).toBe(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    expect(prisma.energyReading.findFirst).not.toHaveBeenCalled();
  });

  // Device baru dari ChirpStack belum punya gateway; room ambil dari device pertama yang punya.
  test("[positive] gateway room diambil dari device pertama yang punya gateway", async () => {
    prisma.room.count.mockResolvedValue(1);
    prisma.room.findMany.mockResolvedValue([
      {
        id: "r1",
        name: "Server",
        location: "L",
        isCritical: false,
        devices: [
          device({ id: "d1", gatewayId: null, gateway: null }),
          device({ id: "d2", gatewayId: "g2", gateway: { name: "Kerlink", eui: "7276ff0045060ffb" } }),
        ],
      },
    ]);
    mockReadings({});

    const [row] = (await roomUseCase.listRoomsPaginated()).data;

    expect(row).toMatchObject({ gatewayId: "g2", gatewayName: "Kerlink", gatewayEui: "7276ff0045060ffb" });
  });

  test("[negative] semua device di room belum punya gateway -> gateway room kosong", async () => {
    prisma.room.count.mockResolvedValue(1);
    prisma.room.findMany.mockResolvedValue([
      { id: "r1", name: "Server", devices: [device({ gatewayId: null, gateway: null })], isCritical: false },
    ]);
    mockReadings({});

    const [row] = (await roomUseCase.listRoomsPaginated()).data;

    expect(row).toMatchObject({ gatewayId: null, gatewayName: null, gatewayEui: null });
  });

  test("[positive] pendingAction ngikutin perintah pending yang paling baru di room", async () => {
    prisma.room.count.mockResolvedValue(1);
    prisma.room.findMany.mockResolvedValue([
      { id: "r1", name: "Server", isCritical: false, devices: [device({ id: "d1" }), device({ id: "d2" }), device({ id: "d3" })] },
    ]);
    mockReadings({});
    deviceUseCase.getPendingCommandsByDevice.mockResolvedValue(
      new Map([
        ["d1", { id: "c1", action: "on", requestedAt: new Date("2026-09-17T10:00:00Z") }],
        ["d2", { id: "c2", action: "off", requestedAt: new Date("2026-09-17T10:05:00Z") }],
      ]),
    );

    const [row] = (await roomUseCase.listRoomsPaginated()).data;

    expect(row).toMatchObject({ pendingAction: "off", pendingCommandCount: 2 });
  });

  test("[negative] tidak ada perintah pending -> pendingAction, pendingResync null & jumlah 0", async () => {
    prisma.room.count.mockResolvedValue(1);
    prisma.room.findMany.mockResolvedValue([{ id: "r1", name: "Server", isCritical: false, devices: [device()] }]);
    mockReadings({});

    const [row] = (await roomUseCase.listRoomsPaginated()).data;

    expect(row).toMatchObject({ pendingAction: null, pendingResync: null, pendingCommandCount: 0 });
  });

  test("[positive] pendingResync: yang lagi nungguin uplink didahulukan dari yang lagi jeda", async () => {
    prisma.room.count.mockResolvedValue(1);
    prisma.room.findMany.mockResolvedValue([
      { id: "r1", name: "Server", isCritical: false, devices: [device({ id: "d1" }), device({ id: "d2" })] },
    ]);
    mockReadings({});
    deviceUseCase.getPendingCommandsByDevice.mockResolvedValue(
      new Map([
        ["d1", { id: "c1", action: "on", requestedAt: new Date(), resync: { attempt: 2, maxAttempts: null, nextRetryAt: "2026-09-17T10:00:10.000Z" } }],
        ["d2", { id: "c2", action: "on", requestedAt: new Date(), resync: { attempt: 4, maxAttempts: null, nextRetryAt: null } }],
      ]),
    );

    const [row] = (await roomUseCase.listRoomsPaginated()).data;

    expect(row.pendingResync).toEqual({ attempt: 4, maxAttempts: null, nextRetryAt: null });
  });

  test("[positive] pendingResync: sama-sama lagi jeda -> yang paling cepat dicoba lagi", async () => {
    prisma.room.count.mockResolvedValue(1);
    prisma.room.findMany.mockResolvedValue([
      { id: "r1", name: "Server", isCritical: false, devices: [device({ id: "d1" }), device({ id: "d2" })] },
    ]);
    mockReadings({});
    deviceUseCase.getPendingCommandsByDevice.mockResolvedValue(
      new Map([
        ["d1", { id: "c1", action: "on", requestedAt: new Date(), resync: { attempt: 2, maxAttempts: null, nextRetryAt: "2026-09-17T10:00:30.000Z" } }],
        ["d2", { id: "c2", action: "on", requestedAt: new Date(), resync: { attempt: 5, maxAttempts: null, nextRetryAt: "2026-09-17T10:00:10.000Z" } }],
      ]),
    );

    const [row] = (await roomUseCase.listRoomsPaginated()).data;

    expect(row.pendingResync).toMatchObject({ attempt: 5, nextRetryAt: "2026-09-17T10:00:10.000Z" });
  });

  test("[negative] perintah pending belum punya progres percobaan -> pendingResync null", async () => {
    prisma.room.count.mockResolvedValue(1);
    prisma.room.findMany.mockResolvedValue([{ id: "r1", name: "Server", isCritical: false, devices: [device({ id: "d1" })] }]);
    mockReadings({});
    deviceUseCase.getPendingCommandsByDevice.mockResolvedValue(
      new Map([["d1", { id: "c1", action: "on", requestedAt: new Date(), resync: null }]]),
    );

    const [row] = (await roomUseCase.listRoomsPaginated()).data;

    expect(row).toMatchObject({ pendingCommandCount: 1, pendingResync: null });
  });

  // Batas online room = batas paling akhir dari device-devicenya (interval 15 mnt + tenggang 2 mnt).
  test("[positive] onlineUntil room = batas online paling akhir dari device-devicenya", async () => {
    const earlier = new Date("2026-09-17T09:00:00Z");
    const later = new Date("2026-09-17T09:10:00Z");
    prisma.room.count.mockResolvedValue(1);
    prisma.room.findMany.mockResolvedValue([
      {
        id: "r1",
        name: "Server",
        isCritical: false,
        devices: [device({ id: "d1", lastSeenAt: earlier }), device({ id: "d2", lastSeenAt: later })],
      },
    ]);
    mockReadings({});

    const [row] = (await roomUseCase.listRoomsPaginated()).data;

    expect(row.onlineUntil).toEqual(new Date(later.getTime() + 15 * 60000 + 120000));
  });

  test("[negative] belum ada device yang pernah kirim uplink -> onlineUntil null & semua offline", async () => {
    prisma.room.count.mockResolvedValue(1);
    prisma.room.findMany.mockResolvedValue([
      { id: "r1", name: "Server", isCritical: false, devices: [device({ lastSeenAt: null })] },
    ]);
    mockReadings({});

    const [row] = (await roomUseCase.listRoomsPaginated()).data;

    expect(row).toMatchObject({ onlineUntil: null, devicesOnline: 0, devicesOffline: 1 });
  });

  test("[positive] search & rentang tanggal & paginasi", async () => {
    prisma.room.count.mockResolvedValue(0);
    prisma.room.findMany.mockResolvedValue([]);
    await roomUseCase.listRoomsPaginated({ search: "srv", createdFrom: "2026-09-01", createdTo: "2026-09-02", page: 2, rowsPerPage: 5 });
    const { where, skip, take } = prisma.room.findMany.mock.calls[0][0];
    expect(where.AND[0].OR).toHaveLength(3);
    expect(where.AND[1].createdAt.lte.getHours()).toBe(23);
    expect([skip, take]).toEqual([5, 5]);
  });
});

describe("getRoomById", () => {
  test("[negative] room tidak ditemukan -> null", async () => {
    prisma.room.findUnique.mockResolvedValue(null);
    await expect(roomUseCase.getRoomById("x")).resolves.toBeNull();
  });

  test("[positive] detail + usage + daftar device dengan pendingCommand", async () => {
    prisma.room.findUnique.mockResolvedValue({ id: "r1", name: "Server", updatedAt: new Date("2026-09-14") });
    prisma.device.count.mockResolvedValue(1);
    prisma.device.findMany
      .mockResolvedValueOnce([device({ status: "on" })])
      .mockResolvedValueOnce([device()]);
    mockReadings({ d1: { latest: 208, earliest: 205 } });
    deviceUseCase.getPendingCommandsByDevice.mockResolvedValue(new Map([["d1", { id: "c1", action: "off" }]]));

    const room = await roomUseCase.getRoomById("r1");

    expect(room.lastUpdatedAt).toEqual(new Date("2026-09-14"));
    expect(room.devices.data[0]).toMatchObject({
      id: "d1",
      deviceEui: "08000000410000e4",
      deviceType: "AC",
      totalUsage24hKwh: 3,
      intervalMinutes: 15,
      isPowerOn: true,
      pendingCommand: { id: "c1", action: "off" },
      isOnline: true,
    });
    expect(room.usage.highestComponent).toEqual({ name: "AC", kwh: 3 });
  });

  // Filter device tidak menyertakan roomId -> detail room berisi device dari SEMUA room.
  test.failing("[BUG] daftar device di detail room seharusnya hanya milik room tersebut", async () => {
    prisma.room.findUnique.mockResolvedValue({ id: "r1", updatedAt: new Date() });
    prisma.device.count.mockResolvedValue(0);
    prisma.device.findMany.mockResolvedValue([]);
    mockReadings({});
    await roomUseCase.getRoomById("r1");
    expect(JSON.stringify(prisma.device.count.mock.calls[0][0])).toContain('"roomId":"r1"');
  });
});

describe("listDevicesInRoom", () => {
  test("[positive] selalu difilter roomId; search angka ikut mencocokkan interval", async () => {
    prisma.device.count.mockResolvedValue(1);
    prisma.device.findMany.mockResolvedValue([device({ eui: "08000000410000e4" })]);
    mockReadings({ d1: { latest: 12.345, earliest: 10 } });
    deviceUseCase.getPendingCommandsByDevice.mockResolvedValue(new Map());

    const result = await roomUseCase.listDevicesInRoom("r1", { search: "30" });

    const { where } = prisma.device.findMany.mock.calls[0][0];
    expect(where.AND[0]).toEqual({ roomId: "r1" });
    expect(where.AND[1].OR).toContainEqual({ intervalMinutes: 30 });
    expect(result.data[0]).toMatchObject({ deviceEui: "08000000410000e4", totalUsage24hKwh: 2.35, pendingCommand: null });
  });

  test("[negative] search teks tidak menambah filter interval", async () => {
    prisma.device.count.mockResolvedValue(0);
    prisma.device.findMany.mockResolvedValue([]);
    await roomUseCase.listDevicesInRoom("r1", { search: "AC", createdFrom: "2026-09-01" });
    const { where } = prisma.device.findMany.mock.calls[0][0];
    expect(where.AND[1].OR).toHaveLength(2);
    expect(where.AND[2].createdAt.gte).toEqual(new Date("2026-09-01"));
  });

  test("[negative] tanpa reading -> pemakaian 0", async () => {
    prisma.device.count.mockResolvedValue(1);
    prisma.device.findMany.mockResolvedValue([device()]);
    mockReadings({});
    expect((await roomUseCase.listDevicesInRoom("r1")).data[0].totalUsage24hKwh).toBe(0);
  });
});

describe("getRoomUsageSummary", () => {
  test("[negative] room tidak ditemukan -> 404", async () => {
    prisma.room.findUnique.mockResolvedValue(null);
    await expect(roomUseCase.getRoomUsageSummary("x")).rejects.toMatchObject({ status: 404 });
  });

  test("[negative] room tanpa device -> semua 0 & highestComponent '-'", async () => {
    prisma.room.findUnique.mockResolvedValue({ id: "r1" });
    prisma.device.findMany.mockResolvedValue([]);
    await expect(roomUseCase.getRoomUsageSummary("r1")).resolves.toEqual({
      total24hKwh: 0,
      avg24hKwh: 0,
      peakKwh: 0,
      highestComponent: { name: "-", kwh: 0 },
    });
  });

  // Dulu _sum dari angka meter kumulatif (205,0 + 205,5 = 410,5 kWh). Sekarang selisih meter.
  test("[positive] total 24 jam = selisih meter; rata-rata & puncak per jam; device paling boros", async () => {
    prisma.room.findUnique.mockResolvedValue({ id: "r1" });
    prisma.device.findMany.mockResolvedValue([device({ id: "d1", name: "AC" }), device({ id: "d2", name: "UPS" })]);
    prisma.$queryRaw.mockResolvedValue([
      { deviceId: "d1", hour: new Date("2026-09-14T01:00:00Z"), kwh: 0.3 },
      { deviceId: "d2", hour: new Date("2026-09-14T01:00:00Z"), kwh: 0.9 },
      { deviceId: "d1", hour: new Date("2026-09-14T02:00:00Z"), kwh: 1.2 },
    ]);
    await expect(roomUseCase.getRoomUsageSummary("r1")).resolves.toEqual({
      total24hKwh: 2.4,
      avg24hKwh: 0.1,
      peakKwh: 1.2,
      highestComponent: { name: "AC", kwh: 1.5 },
    });
    expect(prisma.energyReading.aggregate).not.toHaveBeenCalled();
  });
});

describe("listRoomsSummary & getRoomStats", () => {
  test("[positive] ringkasan room dengan status on/off & gatewayEui", async () => {
    prisma.room.findMany.mockResolvedValue([
      { id: "r1", name: "Server", location: "L", isCritical: false, devices: [device({ status: "on", gateway: { eui: "GW" } })] },
    ]);
    mockReadings({});
    const [row] = await roomUseCase.listRoomsSummary({ search: "Ser" });
    expect(prisma.room.findMany.mock.calls[0][0].where).toEqual({ name: { contains: "Ser", mode: "insensitive" } });
    expect(row).toMatchObject({ gatewayEui: "GW", deviceOnlineCount: 1, status: "on" });
  });

  test("[positive] ringkasan room: gatewayEui dari device pertama yang punya gateway", async () => {
    prisma.room.findMany.mockResolvedValue([
      {
        id: "r1",
        name: "Server",
        location: "L",
        isCritical: false,
        devices: [
          device({ id: "d1", gatewayId: null, gateway: null }),
          device({ id: "d2", gatewayId: "g2", gateway: { eui: "7276ff0045060ffb" } }),
        ],
      },
    ]);
    mockReadings({});

    const [row] = await roomUseCase.listRoomsSummary();

    expect(row.gatewayEui).toBe("7276ff0045060ffb");
  });

  test("[negative] tanpa search -> where undefined; room tanpa device -> gatewayEui null & off", async () => {
    prisma.room.findMany.mockResolvedValue([{ id: "r1", devices: [] }]);
    const [row] = await roomUseCase.listRoomsSummary();
    expect(prisma.room.findMany.mock.calls[0][0].where).toBeUndefined();
    expect(row).toMatchObject({ gatewayEui: null, status: "off" });
  });

  // Status gateway sekarang datang dari ChirpStack (kolom status), bukan ditebak dari device.
  test("[positive] statistik: gateway online ngikutin status dari ChirpStack", async () => {
    prisma.room.count.mockResolvedValue(4);
    prisma.gateway.findMany.mockResolvedValue([
      { id: "g1", status: "online" },
      { id: "g2", status: "offline" },
      { id: "g3", status: "offline" },
    ]);
    prisma.device.findMany.mockResolvedValue([
      { id: "d1", gatewayId: "g1", lastSeenAt: minutesAgo(1), intervalMinutes: 15 },
      { id: "d2", gatewayId: "g1", lastSeenAt: null, intervalMinutes: 15 },
      { id: "d3", gatewayId: "g2", lastSeenAt: minutesAgo(100), intervalMinutes: 15 },
    ]);
    await expect(roomUseCase.getRoomStats()).resolves.toEqual({
      totalRooms: 4,
      totalGateways: { total: 3, online: 1, offline: 2 },
      totalDevices: { total: 3, online: 1, offline: 2 },
    });
  });
});

describe("createRoom / updateRoom / deleteRoom", () => {
  test("[positive] create dengan isCritical default false & event", async () => {
    prisma.room.create.mockResolvedValue({ id: "r1" });
    await roomUseCase.createRoom({ name: "Server", unknownField: "x" });
    const { data } = prisma.room.create.mock.calls[0][0];
    expect(data.isCritical).toBe(false);
    expect(data).not.toHaveProperty("unknownField");
    expect(events.emitRoomCreated).toHaveBeenCalledWith({ id: "r1" });
  });

  test("[positive] update meneruskan field yang diizinkan & event", async () => {
    prisma.room.update.mockResolvedValue({ id: "r1" });
    await roomUseCase.updateRoom("r1", { name: "Baru", isCritical: true });
    expect(prisma.room.update.mock.calls[0][0]).toMatchObject({ where: { id: "r1" }, data: { name: "Baru", isCritical: true } });
    expect(events.emitRoomUpdated).toHaveBeenCalled();
  });

  test("[negative] update room tidak ada (P2025) diteruskan tanpa event", async () => {
    prisma.room.update.mockRejectedValue(Object.assign(new Error("nf"), { code: "P2025" }));
    await expect(roomUseCase.updateRoom("x", {})).rejects.toMatchObject({ code: "P2025" });
    expect(events.emitRoomUpdated).not.toHaveBeenCalled();
  });

  test("[positive] delete room kosong -> log & schedule ikut dihapus dalam transaksi", async () => {
    prisma.device.count.mockResolvedValue(0);
    prisma.room.delete.mockResolvedValue({ id: "r1" });
    await roomUseCase.deleteRoom("r1");
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.commandLog.deleteMany).toHaveBeenCalledWith({ where: { roomId: "r1" } });
    expect(prisma.schedule.deleteMany).toHaveBeenCalledWith({ where: { roomId: "r1" } });
    expect(events.emitRoomDeleted).toHaveBeenCalledWith("r1");
  });

  test("[negative] delete room yang masih punya device -> 409", async () => {
    prisma.device.count.mockResolvedValue(2);
    await expect(roomUseCase.deleteRoom("r1")).rejects.toMatchObject({ status: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("powerRoom", () => {
  test("[negative] room tidak ditemukan -> 404", async () => {
    prisma.room.findUnique.mockResolvedValue(null);
    await expect(roomUseCase.powerRoom("x", "on")).rejects.toMatchObject({ status: 404 });
  });

  test("[positive] setiap device dimasukkan antrean & ringkasan pending/failed", async () => {
    const devices = [device({ id: "d1" }), device({ id: "d2", eui: null })];
    prisma.room.findUnique.mockResolvedValue({ id: "r1", devices });
    deviceUseCase.requestRelayCommand
      .mockResolvedValueOnce({ deviceId: "d1", status: "pending" })
      .mockResolvedValueOnce({ deviceId: "d2", status: "failed" });

    const result = await roomUseCase.powerRoom("r1", "on", { userId: "u1" });

    expect(deviceUseCase.requestRelayCommand).toHaveBeenNthCalledWith(1, devices[0], "on", { userId: "u1" });
    expect(result.summary).toEqual({ total: 2, pending: 1, failed: 1 });
    expect(events.emitRoomPower).toHaveBeenCalledWith("r1", result.results);
  });

  test("[negative] room tanpa device -> hasil kosong, tetap sukses", async () => {
    prisma.room.findUnique.mockResolvedValue({ id: "r1", devices: [] });
    const result = await roomUseCase.powerRoom("r1", "off");
    expect(result).toEqual({ roomId: "r1", action: "off", results: [], summary: { total: 0, pending: 0, failed: 0 } });
  });

  test("[negative] satu device melempar error -> seluruh request gagal (tidak dilanjutkan)", async () => {
    prisma.room.findUnique.mockResolvedValue({ id: "r1", devices: [device({ id: "d1" }), device({ id: "d2" })] });
    deviceUseCase.requestRelayCommand.mockRejectedValueOnce(new Error("redis down"));
    await expect(roomUseCase.powerRoom("r1", "on")).rejects.toThrow("redis down");
    expect(deviceUseCase.requestRelayCommand).toHaveBeenCalledTimes(1);
  });
});

describe("getDeviceLogs", () => {
  test("[negative] device tidak ada atau milik room lain -> 404", async () => {
    prisma.device.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(device({ roomId: "r2" }));
    await expect(roomUseCase.getDeviceLogs("r1", "d1")).rejects.toMatchObject({ status: 404 });
    await expect(roomUseCase.getDeviceLogs("r1", "d1")).rejects.toMatchObject({ status: 404 });
  });

  test("[positive] deskripsi per status & PIC manual/terjadwal", async () => {
    prisma.device.findUnique.mockResolvedValue(device());
    const at = new Date(2026, 8, 14, 7, 5);
    prisma.commandLog.findMany.mockResolvedValue([
      { id: "1", action: "on", status: "success", triggerType: "manual", executedAt: at, triggeredBy: { fullName: "Budi", role: { name: "Admin" } } },
      { id: "2", action: "off", status: "success", triggerType: "scheduled", executedAt: at },
      { id: "3", action: "on", status: "failed", notes: "timeout", triggerType: "manual", executedAt: at },
      { id: "4", action: "off", status: "failed", notes: null, triggerType: "manual", executedAt: at },
      { id: "5", action: "on", status: "pending", notes: "menunggu", triggerType: "manual", executedAt: at },
      { id: "6", action: "off", status: "cancelled", notes: null, triggerType: "manual", executedAt: at },
      { id: "7", action: "on", status: "gateway_offline", triggerType: "manual", executedAt: at },
    ]);

    const logs = await roomUseCase.getDeviceLogs("r1", "d1");

    expect(logs[0]).toEqual({ id: "1", date: "2026-09-14", time: "07:05", description: "Device turned ON manually", picName: "Budi", picRole: "Admin" });
    expect(logs[1]).toMatchObject({ description: "Scheduled: device turned OFF", picName: "System", picRole: "Scheduled Job" });
    expect(logs.slice(2).map((l) => l.description)).toEqual([
      "Failed to turn ON (timeout)",
      "Failed to turn OFF",
      "Turning ON, waiting for meter (menunggu)",
      "Command to turn OFF cancelled",
      "Gateway offline, could not turn ON",
    ]);
    expect(logs[2]).toMatchObject({ picName: "-", picRole: "-" });
  });

  // Riwayat ngikutin device: perintah yang dikirim sebelum device punya room (roomId null) tetap muncul.
  test("[positive] riwayat dicari berdasarkan device saja, bukan room", async () => {
    prisma.device.findUnique.mockResolvedValue(device());
    prisma.commandLog.findMany.mockResolvedValue([]);

    await roomUseCase.getDeviceLogs("r1", "d1");

    expect(prisma.commandLog.findMany.mock.calls[0][0].where).toEqual({ deviceId: "d1" });
  });
});
