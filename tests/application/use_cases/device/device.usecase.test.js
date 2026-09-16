jest.mock("../../../../src/frameworks/chirpstack/client", () => ({
  setRelay: jest.fn(),
  pingTelemetry: jest.fn(),
  listCsDevices: jest.fn(),
  getCsDevice: jest.fn(),
  setReportInterval: jest.fn(),
}));
// Ejaan disamakan dengan require di device.usecase.js (file di disk: deviceSync.js).
jest.mock("../../../../src/frameworks/chirpstack/deviceSync", () => ({
  ensureCsDeviceRegistered: jest.fn(),
  removeCsDevice: jest.fn(),
  rollbackCsDevice: jest.fn(),
  pushReportInterval: jest.fn(),
}));
jest.mock("../../../../src/frameworks/queue/relayCommandQueue", () => ({
  enqueueRelayCommand: jest.fn(),
}));
jest.mock("../../../../src/frameworks/webserver/socket-events", () => ({
  emitDeviceCreated: jest.fn(),
  emitDeviceUpdated: jest.fn(),
  emitDeviceDeleted: jest.fn(),
  emitDeviceStatus: jest.fn(),
  emitDeviceResync: jest.fn(),
  emitDeviceCommand: jest.fn(),
}));

const fs = require("fs");
const path = require("path");
const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const cs = require("../../../../src/frameworks/chirpstack/client");
const sync = require("../../../../src/frameworks/chirpstack/deviceSync");
const { enqueueRelayCommand } = require("../../../../src/frameworks/queue/relayCommandQueue");
const events = require("../../../../src/frameworks/webserver/socket-events");
const logger = require("../../../../src/frameworks/helpers/logger");
const uc = require("../../../../src/application/use_cases/device/device.usecase");
const { resetPrismaMock } = require("../../../helpers/prisma");

const DEV_EUI = "08000000410000e4";
const ROOM = "r1";

function device(overrides = {}) {
  return {
    id: "d1",
    eui: "E1",
    name: "KwH Meter",
    roomId: ROOM,
    gatewayId: "g1",
    eui: DEV_EUI,
    status: "off",
    intervalMinutes: 30,
    lastSeenAt: new Date(Date.now() - 60000),
    ...overrides,
  };
}

const httpErr = (status, message = `HTTP ${status}`) => Object.assign(new Error(message), { status });

/** Simulasi tabel commandLog & device di memori untuk alur relay yang stateful. */
function useStore({ devices = [device()], logs = [] } = {}) {
  const db = { devices: devices.map((d) => ({ ...d })), logs: logs.map((l) => ({ ...l })) };
  let seq = 0;

  const match = (row, where = {}) =>
    Object.entries(where).every(([key, cond]) => {
      if (cond && typeof cond === "object" && !(cond instanceof Date)) {
        if ("in" in cond) return cond.in.includes(row[key]);
        if ("not" in cond) {
          // Prisma: { not: null } juga membuang kolom yang belum diisi.
          if (cond.not === null) return row[key] !== null && row[key] !== undefined;
          return row[key] !== cond.not;
        }
      }
      return row[key] === cond;
    });
  const byDate = (a, b) => b.executedAt - a.executedAt;

  prisma.device.findUnique.mockImplementation(async ({ where }) => {
    const found = db.devices.find((d) => d.id === where.id);
    return found ? { ...found } : null;
  });
  prisma.device.update.mockImplementation(async ({ where, data }) => {
    const found = db.devices.find((d) => d.id === where.id);
    Object.assign(found, data);
    return { ...found };
  });
  prisma.commandLog.create.mockImplementation(async ({ data }) => {
    seq += 1;
    const row = { id: `c${seq}`, executedAt: new Date(Date.now() + seq), notes: null, ...data };
    db.logs.push(row);
    return { ...row };
  });
  prisma.commandLog.findUnique.mockImplementation(async ({ where }) => {
    const found = db.logs.find((l) => l.id === where.id);
    return found ? { ...found } : null;
  });
  prisma.commandLog.findMany.mockImplementation(async ({ where }) =>
    db.logs.filter((l) => match(l, where)).map((l) => ({ ...l })),
  );
  prisma.commandLog.findFirst.mockImplementation(async ({ where }) => {
    const [first] = db.logs.filter((l) => match(l, where)).sort(byDate);
    return first ? { ...first } : null;
  });
  prisma.commandLog.updateMany.mockImplementation(async ({ where, data }) => {
    const rows = db.logs.filter((l) => match(l, where));
    rows.forEach((r) => Object.assign(r, data));
    return { count: rows.length };
  });
  prisma.energyReading.create.mockResolvedValue({});

  return {
    db,
    log: (id) => db.logs.find((l) => l.id === id),
    device: (id = "d1") => db.devices.find((d) => d.id === id),
  };
}

beforeEach(() => {
  // resetAllMocks dulu, baru pasang ulang default prisma ($transaction).
  jest.resetAllMocks();
  resetPrismaMock(prisma);
  // Jeda retry/lock dijalankan instan supaya test cepat tetapi urutan async tetap sama.
  jest.spyOn(global, "setTimeout").mockImplementation((fn, _ms, ...args) => setImmediate(fn, ...args));
  enqueueRelayCommand.mockResolvedValue({});
  sync.pushReportInterval.mockResolvedValue({ delivered: true });
  sync.ensureCsDeviceRegistered.mockResolvedValue({ created: true });
  sync.removeCsDevice.mockResolvedValue({ deleted: true });
});

afterEach(() => {
  global.setTimeout.mockRestore();
});

describe("struktur modul", () => {
  // Dulu file di disk "devicesync.js" tapi di-require "deviceSync": lolos di macOS, crash di Linux/Docker.
  test("[positive] nama file deviceSync.js sama persis dengan path require (filesystem case-sensitive)", () => {
    const dir = path.join(__dirname, "../../../../src/frameworks/chirpstack");
    const files = fs.readdirSync(dir);
    expect(files).toContain("deviceSync.js");
    expect(files).not.toContain("devicesync.js");
  });
});

describe("listDevicesPaginated & getDeviceById", () => {
  test("[positive] setiap device diberi pendingCommand (null kalau tidak ada)", async () => {
    prisma.device.count.mockResolvedValue(2);
    prisma.device.findMany.mockResolvedValue([device({ id: "d1" }), device({ id: "d2" })]);
    prisma.commandLog.findMany.mockResolvedValue([
      { id: "c1", deviceId: "d2", action: "on", notes: "n", executedAt: new Date("2026-09-14T10:00:00Z") },
    ]);

    const result = await uc.listDevicesPaginated({ page: 1, rowsPerPage: 10 });

    expect(result.data[0].pendingCommand).toBeNull();
    expect(result.data[1].pendingCommand).toMatchObject({
      id: "c1",
      action: "on",
      notes: "n",
      requestedAt: new Date("2026-09-14T10:00:00Z"),
      deadline: new Date("2026-09-14T10:30:00Z"),
    });
    expect(result).toMatchObject({ totalRows: 2, totalPages: 1 });
  });

  test("[positive] filter room, gateway, search 8 kolom & tanggal", async () => {
    prisma.device.count.mockResolvedValue(0);
    prisma.device.findMany.mockResolvedValue([]);
    await uc.listDevicesPaginated({ roomId: "r1", gatewayId: "g1", search: "AC", createdFrom: "2026-09-01", createdTo: "2026-09-02" });
    const { where } = prisma.device.findMany.mock.calls[0][0];
    expect(where.AND[0]).toEqual({ roomId: "r1" });
    expect(where.AND[1]).toEqual({ gatewayId: "g1" });
    expect(where.AND[2].OR).toHaveLength(7);
    expect(where.AND[3].createdAt.lte.getHours()).toBe(23);
    expect(prisma.commandLog.findMany).not.toHaveBeenCalled();
  });

  test("[positive/negative] getDeviceById dengan pendingCommand & tidak ditemukan", async () => {
    prisma.device.findUnique.mockResolvedValueOnce(device()).mockResolvedValueOnce(null);
    prisma.commandLog.findMany.mockResolvedValue([]);
    await expect(uc.getDeviceById("d1")).resolves.toMatchObject({ id: "d1", pendingCommand: null });
    await expect(uc.getDeviceById("x")).resolves.toBeNull();
  });
});

describe("getUncertainStatusDeviceIds", () => {
  const minutesAgo = (m) => new Date(Date.now() - m * 60000);

  // Dihitung di server supaya penanda "status belum pasti" nggak hilang saat halaman di-reload.
  test("[positive] perintah terakhir batal setelah downlink terkirim & belum ada uplink -> ditandai", async () => {
    prisma.commandLog.findMany.mockResolvedValue([
      { deviceId: "d1", status: "cancelled", sentAt: minutesAgo(5) },
    ]);
    const result = await uc.getUncertainStatusDeviceIds([
      device({ id: "d1", lastSeenAt: minutesAgo(20) }),
    ]);
    expect([...result]).toEqual(["d1"]);

    const { where, distinct } = prisma.commandLog.findMany.mock.calls[0][0];
    expect(where).toEqual({ deviceId: { in: ["d1"] } });
    expect(distinct).toEqual(["deviceId"]);
  });

  test("[negative] sudah ada uplink setelah downlink terkirim -> status sudah pasti", async () => {
    prisma.commandLog.findMany.mockResolvedValue([
      { deviceId: "d1", status: "failed", sentAt: minutesAgo(20) },
    ]);
    const result = await uc.getUncertainStatusDeviceIds([
      device({ id: "d1", lastSeenAt: minutesAgo(1) }),
    ]);
    expect(result.size).toBe(0);
  });

  test("[positive] device belum pernah kirim uplink -> ikut ditandai", async () => {
    prisma.commandLog.findMany.mockResolvedValue([
      { deviceId: "d1", status: "cancelled", sentAt: minutesAgo(5) },
    ]);
    const result = await uc.getUncertainStatusDeviceIds([
      device({ id: "d1", lastSeenAt: null }),
    ]);
    expect([...result]).toEqual(["d1"]);
  });

  // Perintah berikutnya yang berhasil = bukti relai sudah di posisi yang benar.
  test("[negative] perintah terakhir sukses -> keraguan hilang walau sebelumnya ada yang gagal", async () => {
    prisma.commandLog.findMany.mockResolvedValue([
      { deviceId: "d1", status: "success", sentAt: minutesAgo(2) },
    ]);
    const result = await uc.getUncertainStatusDeviceIds([
      device({ id: "d1", lastSeenAt: minutesAgo(30) }),
    ]);
    expect(result.size).toBe(0);
  });

  test("[negative] perintah terakhir masih pending -> belum ditandai (UI pakai tampilan pending)", async () => {
    prisma.commandLog.findMany.mockResolvedValue([
      { deviceId: "d1", status: "pending", sentAt: minutesAgo(1) },
    ]);
    const result = await uc.getUncertainStatusDeviceIds([
      device({ id: "d1", lastSeenAt: minutesAgo(30) }),
    ]);
    expect(result.size).toBe(0);
  });

  test("[negative] data lama tanpa sentAt -> diabaikan", async () => {
    prisma.commandLog.findMany.mockResolvedValue([
      { deviceId: "d1", status: "cancelled", sentAt: null },
    ]);
    const result = await uc.getUncertainStatusDeviceIds([device({ lastSeenAt: null })]);
    expect(result.size).toBe(0);
  });

  test("[negative] daftar device kosong -> tanpa query", async () => {
    const result = await uc.getUncertainStatusDeviceIds([]);
    expect(result.size).toBe(0);
    expect(prisma.commandLog.findMany).not.toHaveBeenCalled();
  });
});

describe("data ChirpStack di daftar device", () => {
  const csRow = (overrides = {}) => ({
    devEui: DEV_EUI.toUpperCase(),
    name: "KwH Meter Master",
    deviceProfileId: "profile-1",
    lastSeenAt: "2026-09-16T08:18:52.202Z",
    ...overrides,
  });

  function mockList(devices) {
    prisma.device.count.mockResolvedValue(devices.length);
    prisma.device.findMany.mockResolvedValue(devices);
    prisma.commandLog.findMany.mockResolvedValue([]);
  }

  test("[positive] data ChirpStack ditempel ke baris device (EUI beda huruf besar/kecil tetap cocok)", async () => {
    mockList([device()]);
    cs.listCsDevices.mockResolvedValue({ data: { result: [csRow()] } });

    const { data } = await uc.listDevicesPaginated();

    expect(data[0].chirpstack).toEqual({
      registered: true,
      name: "KwH Meter Master",
      deviceProfileId: "profile-1",
      lastSeenAt: "2026-09-16T08:18:52.202Z",
    });
    // Cukup sekali panggil buat satu halaman, bukan per device.
    expect(cs.listCsDevices).toHaveBeenCalledTimes(1);
  });

  test("[negative] devEUI ada di EMS tapi nggak ada di ChirpStack -> registered false", async () => {
    mockList([device()]);
    cs.listCsDevices.mockResolvedValue({ data: { result: [csRow({ devEui: "aaaaaaaaaaaaaaaa" })] } });

    const { data } = await uc.listDevicesPaginated();
    expect(data[0].chirpstack).toEqual({ registered: false, name: null, lastSeenAt: null });
  });

  test("[negative] device belum punya devEUI -> chirpstack null", async () => {
    mockList([device({ eui: null })]);
    cs.listCsDevices.mockResolvedValue({ data: { result: [] } });

    const { data } = await uc.listDevicesPaginated();
    expect(data[0].chirpstack).toBeNull();
  });

  // Middleware mati jangan bikin halaman device ikut mati, dan jangan ngaku belum terdaftar.
  test("[negative] middleware nggak bisa dihubungi -> chirpstack null, daftar device tetap tampil", async () => {
    mockList([device()]);
    cs.listCsDevices.mockRejectedValue(new Error("ECONNREFUSED"));

    const { data } = await uc.listDevicesPaginated();
    expect(data).toHaveLength(1);
    expect(data[0].chirpstack).toBeNull();
  });

  test("[positive] detail device juga bawa data ChirpStack", async () => {
    prisma.device.findUnique.mockResolvedValue(device());
    prisma.commandLog.findMany.mockResolvedValue([]);
    cs.listCsDevices.mockResolvedValue({ data: { result: [csRow()] } });

    const result = await uc.getDeviceById("d1");
    expect(result.chirpstack).toMatchObject({ registered: true, name: "KwH Meter Master" });
  });
});

describe("syncDevicesFromChirpstack", () => {
  const csRow = (devEui = DEV_EUI) => ({ devEui, name: "KwH Meter Master", lastSeenAt: null });

  test("[positive] device yang udah dihapus di ChirpStack ikut dihapus di EMS", async () => {
    prisma.device.findMany.mockResolvedValue([device({ id: "d1", eui: "aaaaaaaaaaaaaaaa" })]);
    cs.listCsDevices.mockResolvedValue({ data: { result: [csRow()] } });
    prisma.device.delete.mockResolvedValue({ id: "d1" });

    const result = await uc.syncDevicesFromChirpstack();

    expect(prisma.energyReading.deleteMany).toHaveBeenCalledWith({ where: { deviceId: "d1" } });
    expect(prisma.device.delete).toHaveBeenCalledWith({ where: { id: "d1" } });
    expect(events.emitDeviceDeleted).toHaveBeenCalledWith("d1");
    expect(result).toEqual({ checked: 1, deleted: 1 });
  });

  test("[negative] device yang masih ada di ChirpStack aman (EUI beda huruf besar/kecil tetap cocok)", async () => {
    prisma.device.findMany.mockResolvedValue([device({ id: "d1" })]);
    cs.listCsDevices.mockResolvedValue({ data: { result: [csRow(DEV_EUI.toUpperCase())] } });

    const result = await uc.syncDevicesFromChirpstack();

    expect(prisma.device.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, deleted: 0 });
  });

  // Pengaman: middleware error jangan sampai ngehapus semua device.
  test("[negative] middleware mati -> nggak ada yang dihapus", async () => {
    cs.listCsDevices.mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await uc.syncDevicesFromChirpstack();
    expect(prisma.device.findMany).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 0, deleted: 0 });
  });

  test("[negative] daftar ChirpStack kosong -> dianggap nggak wajar, nggak ada yang dihapus", async () => {
    cs.listCsDevices.mockResolvedValue({ data: { result: [] } });
    const result = await uc.syncDevicesFromChirpstack();
    expect(prisma.device.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ checked: 0, deleted: 0 });
  });

  test("[negative] device tanpa devEUI dilewat (cuma ada di EMS)", async () => {
    prisma.device.findMany.mockResolvedValue([]);
    cs.listCsDevices.mockResolvedValue({ data: { result: [csRow()] } });

    await uc.syncDevicesFromChirpstack();

    expect(prisma.device.findMany).toHaveBeenCalledWith({ where: { eui: { not: "" } } });
    expect(prisma.device.delete).not.toHaveBeenCalled();
  });
});

describe("createDevice", () => {
  // eui device = devEUI ChirpStack; nggak ada lagi field ThingsBoard device ID.
  const input = { eui: DEV_EUI, name: "Meter", roomId: ROOM, gatewayId: "g1" };

  test("[positive] interval default 15 & device langsung didaftarkan ke ChirpStack", async () => {
    prisma.device.create.mockResolvedValue(device({ intervalMinutes: 15 }));
    await uc.createDevice(input);
    expect(prisma.device.create.mock.calls[0][0].data).toMatchObject({ eui: DEV_EUI, intervalMinutes: 15 });
    expect(sync.ensureCsDeviceRegistered).toHaveBeenCalled();
    expect(events.emitDeviceCreated).toHaveBeenCalled();
  });

  test("[positive] devEUI dinormalisasi, didaftarkan ke ChirpStack & interval dikirim", async () => {
    prisma.device.create.mockResolvedValue(device());
    await uc.createDevice({ ...input, eui: " 08000000410000E4 ", intervalMinutes: 30 });
    expect(prisma.device.create.mock.calls[0][0].data.eui).toBe(DEV_EUI);
    expect(sync.ensureCsDeviceRegistered).toHaveBeenCalledWith(DEV_EUI, { name: "KwH Meter", description: "", updateIfExists: false });
    expect(sync.pushReportInterval).toHaveBeenCalledWith(DEV_EUI, 30);
  });

  test("[negative] registrasi ChirpStack gagal -> baris DB dihapus lagi & error diteruskan", async () => {
    prisma.device.create.mockResolvedValue(device());
    sync.ensureCsDeviceRegistered.mockRejectedValue(httpErr(500));
    await expect(uc.createDevice({ ...input, eui: DEV_EUI })).rejects.toMatchObject({ status: 500 });
    expect(prisma.device.delete).toHaveBeenCalledWith({ where: { id: "d1" } });
    expect(events.emitDeviceCreated).not.toHaveBeenCalled();
  });

  test.each([
    [["eui"], "devEUI sudah dipakai device lain"],
    ["eui", "devEUI sudah dipakai device lain"],
    [undefined, "Nilai unik sudah dipakai device lain"],
  ])("[negative] duplikat P2002 target %j -> 409 '%s'", async (target, message) => {
    prisma.device.create.mockRejectedValue(Object.assign(new Error("Unique"), { code: "P2002", meta: { target } }));
    await expect(uc.createDevice(input)).rejects.toMatchObject({ status: 409, message });
  });

  test("[negative] error Prisma lain diteruskan apa adanya", async () => {
    const err = Object.assign(new Error("FK"), { code: "P2003" });
    prisma.device.create.mockRejectedValue(err);
    await expect(uc.createDevice(input)).rejects.toBe(err);
  });

  test("[negative] devEUI tidak valid -> 400 sebelum insert", async () => {
    await expect(uc.createDevice({ ...input, eui: "123" })).rejects.toMatchObject({ status: 400 });
    expect(prisma.device.create).not.toHaveBeenCalled();
  });
});

describe("updateDevice", () => {
  test("[negative] device tidak ada -> 404", async () => {
    prisma.device.findUnique.mockResolvedValue(null);
    await expect(uc.updateDevice("x", {})).rejects.toMatchObject({ status: 404 });
  });

  test("[positive] ganti nama saja -> sinkron nama ke ChirpStack, interval tidak dikirim ulang", async () => {
    prisma.device.findUnique.mockResolvedValue(device());
    prisma.device.update.mockResolvedValue(device({ name: "Baru" }));
    await uc.updateDevice("d1", { name: "Baru" });
    expect(sync.ensureCsDeviceRegistered).toHaveBeenCalledWith(DEV_EUI, { name: "Baru", description: "" });
    expect(prisma.device.update.mock.calls[0][0].data.eui).toBeUndefined();
    expect(sync.pushReportInterval).not.toHaveBeenCalled();
    expect(events.emitDeviceUpdated).toHaveBeenCalled();
  });

  test("[positive] interval berubah -> dikirim ke meter", async () => {
    prisma.device.findUnique.mockResolvedValue(device({ intervalMinutes: 30 }));
    prisma.device.update.mockResolvedValue(device({ intervalMinutes: 60 }));
    await uc.updateDevice("d1", { intervalMinutes: 60 });
    expect(sync.pushReportInterval).toHaveBeenCalledWith(DEV_EUI, 60);
  });

  test("[negative] interval sama (string vs number) -> tidak dikirim", async () => {
    prisma.device.findUnique.mockResolvedValue(device({ intervalMinutes: 30 }));
    prisma.device.update.mockResolvedValue(device());
    await uc.updateDevice("d1", { intervalMinutes: "30" });
    expect(sync.pushReportInterval).not.toHaveBeenCalled();
  });

  test("[positive] ganti devEUI -> devEUI lama dilepas (log), interval dikirim ke devEUI baru", async () => {
    const next = "0800000041000099";
    prisma.device.findUnique.mockResolvedValue(device());
    prisma.device.update.mockResolvedValue(device({ eui: next }));
    await uc.updateDevice("d1", { eui: next.toUpperCase() });
    expect(sync.ensureCsDeviceRegistered).toHaveBeenCalledWith(next, expect.any(Object));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("dilepas dari EMS"));
    expect(sync.pushReportInterval).toHaveBeenCalledWith(next, 30);
  });

  test("[negative] devEUI dikosongkan -> tidak registrasi ke ChirpStack", async () => {
    prisma.device.findUnique.mockResolvedValue(device());
    prisma.device.update.mockResolvedValue(device({ eui: null }));
    await uc.updateDevice("d1", { eui: null });
    expect(sync.ensureCsDeviceRegistered).not.toHaveBeenCalled();
    expect(prisma.device.update.mock.calls[0][0].data.eui).toBeNull();
  });

  test("[negative] ChirpStack gagal -> DB tidak di-update", async () => {
    prisma.device.findUnique.mockResolvedValue(device());
    sync.ensureCsDeviceRegistered.mockRejectedValue(httpErr(503));
    await expect(uc.updateDevice("d1", { name: "x" })).rejects.toMatchObject({ status: 503 });
    expect(prisma.device.update).not.toHaveBeenCalled();
  });
});

describe("deleteDevice", () => {
  test("[negative] device tidak ada -> 404", async () => {
    prisma.device.findUnique.mockResolvedValue(null);
    await expect(uc.deleteDevice("x")).rejects.toMatchObject({ status: 404 });
  });

  test("[positive] hapus di ChirpStack, lalu reading dihapus & log/schedule dilepas dalam transaksi", async () => {
    prisma.device.findUnique.mockResolvedValue({ id: "d1", eui: DEV_EUI, name: "M" });
    prisma.device.delete.mockResolvedValue({ id: "d1" });
    await uc.deleteDevice("d1");
    expect(sync.removeCsDevice).toHaveBeenCalledWith(DEV_EUI);
    expect(prisma.energyReading.deleteMany).toHaveBeenCalledWith({ where: { deviceId: "d1" } });
    expect(prisma.commandLog.updateMany).toHaveBeenCalledWith({ where: { deviceId: "d1" }, data: { deviceId: null } });
    expect(prisma.schedule.updateMany).toHaveBeenCalledWith({ where: { deviceId: "d1" }, data: { deviceId: null } });
    expect(events.emitDeviceDeleted).toHaveBeenCalledWith("d1");
  });

  test("[positive] device tanpa devEUI -> tidak memanggil ChirpStack", async () => {
    prisma.device.findUnique.mockResolvedValue({ id: "d1", eui: null });
    prisma.device.delete.mockResolvedValue({ id: "d1" });
    await uc.deleteDevice("d1");
    expect(sync.removeCsDevice).not.toHaveBeenCalled();
  });

  test("[negative] ChirpStack gagal -> data DB tidak dihapus", async () => {
    prisma.device.findUnique.mockResolvedValue({ id: "d1", eui: DEV_EUI });
    sync.removeCsDevice.mockRejectedValue(httpErr(500));
    await expect(uc.deleteDevice("d1")).rejects.toMatchObject({ status: 500 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  // Urutan hapus ChirpStack dulu baru DB tanpa kompensasi.
  test.failing("[BUG] transaksi DB gagal seharusnya tidak meninggalkan device yang sudah terhapus di ChirpStack", async () => {
    prisma.device.findUnique.mockResolvedValue({ id: "d1", eui: DEV_EUI });
    prisma.$transaction.mockRejectedValue(new Error("db down"));
    await expect(uc.deleteDevice("d1")).rejects.toThrow("db down");
    expect(sync.removeCsDevice).not.toHaveBeenCalled();
  });
});

describe("requestRelayCommand / powerDevice", () => {
  test("[positive] membuat command pending, emit event, lalu masuk antrean", async () => {
    const store = useStore();
    const result = await uc.powerDevice("d1", "on", { userId: "u1" });

    expect(result).toMatchObject({ commandId: "c1", deviceId: "d1", deviceName: "KwH Meter", action: "on", status: "pending" });
    expect(store.log("c1")).toMatchObject({ triggerType: "manual", triggeredByUserId: "u1", scheduleId: null });
    expect(enqueueRelayCommand).toHaveBeenCalledWith("c1");
    expect(events.emitDeviceCommand).toHaveBeenCalledWith(expect.objectContaining({ commandId: "c1", status: "pending" }));
    expect(new Date(result.deadline) - new Date(result.requestedAt)).toBe(30 * 60 * 1000);
  });

  test("[positive] dari schedule -> triggerType scheduled", async () => {
    const store = useStore();
    await uc.powerDevice("d1", "off", { scheduleId: "s1" });
    expect(store.log("c1")).toMatchObject({ triggerType: "scheduled", scheduleId: "s1", triggeredByUserId: null });
  });

  test("[positive] perintah baru menggantikan perintah pending sebelumnya", async () => {
    const store = useStore();
    const first = await uc.powerDevice("d1", "on");
    const second = await uc.powerDevice("d1", "off");
    expect(store.log(first.commandId)).toMatchObject({ status: "cancelled", notes: "Digantikan perintah OFF yang lebih baru" });
    expect(store.log(second.commandId).status).toBe("pending");
  });

  // Dulu tiap klik bikin perintah baru: 8 klik = 8 downlink ke meter.
  test("[positive] aksi sama yang masih pending dipakai ulang, bukan bikin perintah baru", async () => {
    const store = useStore();
    const first = await uc.powerDevice("d1", "on", { userId: "u1" });
    enqueueRelayCommand.mockClear();
    events.emitDeviceCommand.mockClear();

    const second = await uc.powerDevice("d1", "on", { userId: "u1" });

    expect(second.commandId).toBe(first.commandId);
    expect(second.status).toBe("pending");
    expect(store.db.logs).toHaveLength(1);
    expect(enqueueRelayCommand).not.toHaveBeenCalled();
    expect(events.emitDeviceCommand).not.toHaveBeenCalled();
  });

  test("[negative] klik beruntun 8x dengan aksi sama -> tetap satu perintah & satu antrean", async () => {
    const store = useStore();
    const results = [];
    for (let i = 0; i < 8; i += 1) results.push(await uc.powerDevice("d1", "off"));

    expect(new Set(results.map((r) => r.commandId)).size).toBe(1);
    expect(store.db.logs.filter((l) => l.status === "pending")).toHaveLength(1);
    expect(enqueueRelayCommand).toHaveBeenCalledTimes(1);
  });

  test("[positive] scheduler mengulang aksi yang sama -> dicatat 'skipped', downlink tidak diulang", async () => {
    const store = useStore();
    const first = await uc.powerDevice("d1", "on", { scheduleId: "s1" });
    enqueueRelayCommand.mockClear();

    const second = await uc.powerDevice("d1", "on", { scheduleId: "s1" });

    expect(second.commandId).not.toBe(first.commandId);
    expect(store.log(second.commandId)).toMatchObject({
      status: "skipped",
      triggerType: "scheduled",
      scheduleId: "s1",
    });
    expect(store.log(first.commandId).status).toBe("pending");
    expect(enqueueRelayCommand).not.toHaveBeenCalled();
    expect(events.emitDeviceCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({ commandId: second.commandId, status: "skipped" }),
    );
  });

  test("[positive] aksi berbeda tetap menggantikan perintah pending (jadwal bisa menimpa manual)", async () => {
    const store = useStore();
    const manual = await uc.powerDevice("d1", "on", { userId: "u1" });
    const scheduled = await uc.powerDevice("d1", "off", { scheduleId: "s1" });

    expect(store.log(manual.commandId).status).toBe("cancelled");
    expect(store.log(scheduled.commandId).status).toBe("pending");
  });

  // Meter yang sudah lewat jadwal lapor tidak akan menerima downlink.
  test("[negative] device offline -> 409 & tidak ada perintah dibuat", async () => {
    const store = useStore({ devices: [device({ lastSeenAt: new Date(Date.now() - 60 * 60000) })] });
    await expect(uc.powerDevice("d1", "on")).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("offline"),
    });
    expect(store.db.logs).toHaveLength(0);
    expect(enqueueRelayCommand).not.toHaveBeenCalled();
  });

  test("[negative] device belum pernah kirim uplink -> dianggap offline, 409", async () => {
    useStore({ devices: [device({ lastSeenAt: null })] });
    await expect(uc.powerDevice("d1", "off")).rejects.toMatchObject({ status: 409 });
  });

  test("[negative] device tidak ada -> 404; tanpa devEUI -> 409 (powerDevice)", async () => {
    useStore({ devices: [device({ eui: null })] });
    await expect(uc.powerDevice("x", "on")).rejects.toMatchObject({ status: 404 });
    await expect(uc.powerDevice("d1", "on")).rejects.toMatchObject({ status: 409 });
  });

  test("[negative] requestRelayCommand langsung untuk device tanpa devEUI -> log failed, tidak masuk antrean", async () => {
    const store = useStore();
    const result = await uc.requestRelayCommand(device({ eui: null }), "on");
    expect(result.status).toBe("failed");
    expect(store.log(result.commandId).notes).toContain("devEUI kosong");
    expect(enqueueRelayCommand).not.toHaveBeenCalled();
  });

  test("[negative] antrean (Redis) gagal -> command ditandai failed & alasan dikembalikan", async () => {
    const store = useStore();
    enqueueRelayCommand.mockRejectedValue(new Error("ECONNREFUSED"));
    const result = await uc.powerDevice("d1", "on");
    expect(result).toMatchObject({ status: "failed", notes: expect.stringContaining("ECONNREFUSED") });
    expect(store.log(result.commandId).status).toBe("failed");
  });
});

describe("resync status setelah perintah gagal", () => {
  // Kunci "status belum pasti" cuma boleh dibuka sama uplink asli dari meter,
  // bukan karena sudah nunggu sekian lama.
  const flush = async (times = 40) => {
    for (let i = 0; i < times; i += 1) await new Promise((r) => setImmediate(r));
  };

  // Perintah gagal padahal downlink sudah terkirim -> status relai jadi tanda tanya.
  async function failAfterSent() {
    const store = useStore();
    prisma.commandLog.count.mockResolvedValue(0);
    const { commandId } = await uc.powerDevice("d1", "on");
    store.log(commandId).sentAt = new Date();
    await uc.failRelayCommand(commandId, new Error("worker mati"));
    return store;
  }

  test("[positive] ping diulang sampai dapat uplink yang membawa relay_state", async () => {
    cs.pingTelemetry
      .mockRejectedValueOnce(new Error("timeout nunggu uplink"))
      .mockResolvedValueOnce({ telemetry: {} })
      .mockResolvedValueOnce({ telemetry: { relay_state: "OFF" } });

    const store = await failAfterSent();
    await flush();

    expect(cs.pingTelemetry).toHaveBeenCalledTimes(3);
    expect(cs.pingTelemetry).toHaveBeenLastCalledWith(DEV_EUI, { timeout: 150000 });
    expect(store.device().status).toBe("off");
    expect(events.emitDeviceStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: "off", source: "telemetry" }),
    );
  });

  test("[positive] berhenti begitu uplink pertama sudah membawa relay_state", async () => {
    cs.pingTelemetry.mockResolvedValue({ telemetry: { relay_state: "ON" } });
    const store = await failAfterSent();
    await flush();
    expect(cs.pingTelemetry).toHaveBeenCalledTimes(1);
    expect(store.device().status).toBe("on");
  });

  test("[negative] ada perintah baru yang pending -> resync mundur, biar tidak rebutan meter", async () => {
    const store = useStore();
    const { commandId } = await uc.powerDevice("d1", "on");
    store.log(commandId).sentAt = new Date();
    prisma.commandLog.count.mockResolvedValue(1);

    await uc.failRelayCommand(commandId, new Error("worker mati"));
    await flush();

    expect(cs.pingTelemetry).not.toHaveBeenCalled();
  });

  test("[negative] meter tidak pernah menjawab -> menyerah setelah 20 percobaan, bukan loop selamanya", async () => {
    cs.pingTelemetry.mockRejectedValue(new Error("meter tidur"));
    await failAfterSent();
    await flush(200);
    expect(cs.pingTelemetry).toHaveBeenCalledTimes(20);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("nyerah setelah 20 percobaan"));
  });

  test("[negative] device offline -> resync berhenti, nggak nguber uplink yang nggak bakal datang", async () => {
    const store = useStore();
    prisma.commandLog.count.mockResolvedValue(0);
    const { commandId } = await uc.powerDevice("d1", "on");
    store.log(commandId).sentAt = new Date();
    // meter berhenti melapor sebelum resync sempat jalan
    store.device().lastSeenAt = new Date(Date.now() - 60 * 60000);
    cs.pingTelemetry.mockResolvedValue({ telemetry: { relay_state: "ON" } });

    await uc.failRelayCommand(commandId, new Error("worker mati"));
    await flush();

    // Nggak ada uplink yang bakal datang, jadi resync nggak usah dijalanin sama sekali.
    expect(cs.pingTelemetry).not.toHaveBeenCalled();
    expect(events.emitDeviceResync).not.toHaveBeenCalled();
  });

  test("[positive] device yang statusnya belum pasti langsung dikejar walau backend baru menyala", async () => {
    useStore();
    prisma.commandLog.count.mockResolvedValue(0);
    prisma.commandLog.findMany.mockResolvedValue([
      { deviceId: "d1", status: "cancelled", sentAt: new Date() },
    ]);
    cs.pingTelemetry.mockResolvedValue({ telemetry: { relay_state: "ON" } });

    const result = await uc.getUncertainStatusDeviceIds([
      device({ lastSeenAt: new Date(Date.now() - 60000) }),
    ]);
    await flush();

    expect([...result]).toEqual(["d1"]);
    expect(cs.pingTelemetry).toHaveBeenCalledTimes(1);
  });

  // Progres ini yang dipakai UI buat nampilin "Resync in 12s (3/20)".
  test("[positive] progres resync dikabarkan: percobaan ke berapa & kapan dicoba lagi", async () => {
    cs.pingTelemetry
      .mockRejectedValueOnce(new Error("meter tidur"))
      .mockResolvedValueOnce({ telemetry: { relay_state: "ON" } });

    await failAfterSent();
    await flush();

    const payloads = events.emitDeviceResync.mock.calls.map((c) => c[0]);
    expect(payloads[0]).toMatchObject({ deviceId: "d1", resync: { attempt: 1, maxAttempts: 20, nextRetryAt: null } });
    expect(payloads[1].resync).toMatchObject({ attempt: 1, nextRetryAt: expect.any(String) });
    expect(payloads[2].resync).toMatchObject({ attempt: 2, nextRetryAt: null });
    // Beres -> resync null, penanda hitung mundur di UI ikut hilang.
    expect(payloads[payloads.length - 1].resync).toBeNull();
  });

  test("[positive] progres resync bisa dibaca lagi setelah halaman di-reload", async () => {
    cs.pingTelemetry.mockRejectedValue(new Error("meter tidur"));
    await failAfterSent();
    await new Promise((r) => setImmediate(r));

    const states = uc.getResyncStateByDevice(["d1", "d2"]);
    expect(states.get("d1")).toMatchObject({ attempt: expect.any(Number), maxAttempts: 20 });
    expect(states.has("d2")).toBe(false);
  });

  test("[negative] dipanggil berkali-kali -> tetap satu proses resync per device", async () => {
    useStore();
    prisma.commandLog.count.mockResolvedValue(0);
    prisma.commandLog.findMany.mockResolvedValue([
      { deviceId: "d1", status: "cancelled", sentAt: new Date() },
    ]);
    cs.pingTelemetry.mockResolvedValue({ telemetry: { relay_state: "ON" } });

    const online = device({ lastSeenAt: new Date(Date.now() - 60000) });
    await uc.getUncertainStatusDeviceIds([online]);
    await uc.getUncertainStatusDeviceIds([online]);
    await flush();

    expect(cs.pingTelemetry).toHaveBeenCalledTimes(1);
  });
});

describe("processRelayCommand", () => {
  async function requestThenProcess(action = "on", storeOptions) {
    const store = useStore(storeOptions);
    const { commandId } = await uc.powerDevice("d1", action);
    await uc.processRelayCommand(commandId);
    return { store, commandId };
  }

  test("[positive] meter mengonfirmasi di percobaan pertama -> success, status device & event", async () => {
    cs.setRelay.mockResolvedValue({ data: { stateConfirmed: true } });
    const { store, commandId } = await requestThenProcess("on");

    expect(cs.setRelay).toHaveBeenCalledWith(DEV_EUI, true, { wakeTimeout: 150000, relayTimeout: 90000 });
    expect(store.log(commandId)).toMatchObject({ status: "success", notes: null });
    expect(store.device().status).toBe("on");
    // source "command": status dari perintah, bukan dari uplink meter.
    expect(events.emitDeviceStatus).toHaveBeenCalledWith(expect.objectContaining({ deviceId: "d1", status: "on", source: "command" }));
    expect(events.emitDeviceCommand).toHaveBeenLastCalledWith(expect.objectContaining({ commandId, status: "success" }));
    expect(uc.isDeviceBusy("d1")).toBe(false);
  });

  test("[positive] sentAt diisi tepat sebelum downlink dikirim", async () => {
    cs.setRelay.mockResolvedValue({ data: { stateConfirmed: true } });
    const { store, commandId } = await requestThenProcess("on");
    expect(store.log(commandId).sentAt).toBeInstanceOf(Date);
  });

  test("[negative] perintah yang belum diproses -> sentAt masih kosong (masih bisa dibatalkan)", async () => {
    const store = useStore();
    const { commandId } = await uc.powerDevice("d1", "on");
    expect(store.log(commandId).sentAt ?? null).toBeNull();
  });

  test("[positive] retry: 408 wake -> tidak terkonfirmasi -> sukses di percobaan ke-3", async () => {
    cs.setRelay
      .mockRejectedValueOnce(httpErr(408, "[ChirpStack] HTTP 408 di /api/relay/wake: Meter tidak merespons wake-up"))
      .mockResolvedValueOnce({ data: { stateConfirmed: false } })
      .mockResolvedValueOnce({ data: { stateConfirmed: true } });
    cs.pingTelemetry.mockResolvedValue({ telemetry: { relay_state: "OFF" } });

    const { store, commandId } = await requestThenProcess("on");

    expect(cs.setRelay).toHaveBeenCalledTimes(3);
    expect(cs.pingTelemetry).toHaveBeenCalledTimes(1); // hanya setelah "tidak terkonfirmasi", bukan setelah 408 wake
    expect(store.log(commandId)).toMatchObject({ status: "success", notes: "Berhasil pada percobaan ke-3" });
  });

  test("[positive] konfirmasi hilang tapi telemetry menunjukkan relai sudah pindah -> success tanpa retry", async () => {
    cs.setRelay.mockResolvedValue({ data: { stateConfirmed: false } });
    cs.pingTelemetry.mockResolvedValue({ telemetry: { relay_state: "ON", meter_reading: 1000 } });
    const { store, commandId } = await requestThenProcess("on");
    expect(cs.setRelay).toHaveBeenCalledTimes(1);
    expect(store.log(commandId)).toMatchObject({ status: "success", notes: "Terkonfirmasi lewat telemetry" });
    expect(prisma.energyReading.create).toHaveBeenCalled();
  });

  test("[positive] relai sudah sesuai & perintah terakhir sukses -> downlink dilewati", async () => {
    const { store, commandId } = await requestThenProcess("on", {
      devices: [device({ status: "on" })],
      logs: [{ id: "old", deviceId: "d1", action: "on", status: "success", executedAt: new Date(Date.now() - 120000) }],
    });
    expect(cs.setRelay).not.toHaveBeenCalled();
    expect(store.log(commandId).notes).toContain("downlink dilewati");
  });

  test("[negative] relai terlihat sesuai tapi perintah terakhir gagal -> downlink tetap dikirim", async () => {
    cs.setRelay.mockResolvedValue({ data: { stateConfirmed: true } });
    await requestThenProcess("on", {
      devices: [device({ status: "on", lastSeenAt: new Date(Date.now() - 300000) })],
      logs: [{ id: "old", deviceId: "d1", action: "on", status: "failed", executedAt: new Date(Date.now() - 60000) }],
    });
    expect(cs.setRelay).toHaveBeenCalledTimes(1);
  });

  test("[negative] status di DB sesuai tapi lastSeen sudah basi (> interval) -> downlink dikirim", async () => {
    cs.setRelay.mockResolvedValue({ data: { stateConfirmed: true } });
    await requestThenProcess("on", { devices: [device({ status: "on", lastSeenAt: new Date(Date.now() - 31 * 60000) })] });
    expect(cs.setRelay).toHaveBeenCalled();
  });

  test("[negative] lewat batas 30 menit -> failed tanpa downlink", async () => {
    const store = useStore();
    const { commandId } = await uc.powerDevice("d1", "on");
    store.log(commandId).executedAt = new Date(Date.now() - 31 * 60000);
    await uc.processRelayCommand(commandId);
    expect(cs.setRelay).not.toHaveBeenCalled();
    expect(store.log(commandId)).toMatchObject({ status: "failed", notes: expect.stringContaining("30 menit") });
  });

  test("[negative] command sudah dibatalkan/digantikan sebelum diproses -> tidak ada downlink", async () => {
    const store = useStore();
    const first = await uc.powerDevice("d1", "on");
    await uc.powerDevice("d1", "off");
    await uc.processRelayCommand(first.commandId);
    expect(cs.setRelay).not.toHaveBeenCalled();
    expect(store.log(first.commandId).status).toBe("cancelled");
  });

  // Perintah baru masuk saat downlink lama masih jalan: yang lama ditandai
  // cancelled, tapi relainya terlanjur pindah -> status device harus jujur.
  test("[negative] digantikan perintah baru saat downlink berjalan -> command lama cancelled, status device jujur", async () => {
    const store = useStore();
    const { commandId } = await uc.powerDevice("d1", "on");
    cs.setRelay.mockImplementation(async () => {
      await uc.powerDevice("d1", "off");
      return { data: { stateConfirmed: true } };
    });
    await uc.processRelayCommand(commandId);
    expect(store.log(commandId).status).toBe("cancelled");
    expect(store.device().status).toBe("on");
  });

  // Mati lampu di tengah perintah: dulu nunggu 30 menit, sekarang langsung gagal.
  // Mati lampu: meter nggak nyaut & nggak ada uplink baru -> ditandai offline.
  test("[negative] dua percobaan gagal tanpa uplink -> device ditandai offline & perintah dihentikan", async () => {
    cs.setRelay.mockRejectedValue(
      Object.assign(new Error("[ChirpStack] HTTP 408 di /api/relay/wake: Meter tidak merespons wake-up"), { status: 408 }),
    );
    const store = useStore();
    const { commandId } = await uc.powerDevice("d1", "on");

    await uc.processRelayCommand(commandId);

    expect(cs.setRelay).toHaveBeenCalledTimes(2);
    expect(store.device().commFailedAt).toBeInstanceOf(Date);
    expect(store.log(commandId)).toMatchObject({
      status: "failed",
      notes: expect.stringContaining("offline"),
    });
  });

  test("[positive] percobaan pertama gagal tapi meter sempat lapor -> belum ditandai offline", async () => {
    cs.setRelay.mockResolvedValueOnce({ data: { stateConfirmed: false } }).mockResolvedValueOnce({ data: { stateConfirmed: true } });
    cs.pingTelemetry.mockResolvedValue({ telemetry: { relay_state: "OFF" } });
    const store = useStore();
    const { commandId } = await uc.powerDevice("d1", "on");

    await uc.processRelayCommand(commandId);

    expect(store.device().commFailedAt ?? null).toBeNull();
    expect(store.log(commandId).status).toBe("success");
  });

  test("[positive] uplink masuk -> tanda gagal komunikasi dibersihkan (online lagi)", async () => {
    const store = useStore({ devices: [device({ commFailedAt: new Date() })] });
    cs.pingTelemetry.mockResolvedValue({ telemetry: { relay_state: "ON", meter_reading: 1000 } });

    await uc.fetchAndStoreTelemetry(store.device());

    expect(store.device().commFailedAt).toBeNull();
  });

  test("[negative] meter berhenti melapor saat perintah jalan -> langsung failed, bukan retry 30 menit", async () => {
    const store = useStore();
    const { commandId } = await uc.powerDevice("d1", "on");
    store.device().lastSeenAt = new Date(Date.now() - 60 * 60000);

    await uc.processRelayCommand(commandId);

    expect(cs.setRelay).not.toHaveBeenCalled();
    expect(store.log(commandId)).toMatchObject({
      status: "failed",
      notes: expect.stringContaining("offline"),
    });
  });

  test("[negative] device dihapus / devEUI dilepas setelah request -> failed", async () => {
    const store = useStore();
    const { commandId } = await uc.powerDevice("d1", "on");
    store.device().eui = null;
    await uc.processRelayCommand(commandId);
    expect(store.log(commandId)).toMatchObject({ status: "failed", notes: expect.stringContaining("devEUI kosong") });

    const store2 = useStore();
    const second = await uc.powerDevice("d1", "on");
    store2.db.devices.length = 0;
    await uc.processRelayCommand(second.commandId);
    expect(store2.log(second.commandId)).toMatchObject({ status: "failed", notes: "Device sudah dihapus" });
  });

  test("[negative] command id tidak dikenal -> selesai tanpa aksi", async () => {
    useStore();
    await expect(uc.processRelayCommand("ghost")).resolves.toBeUndefined();
    expect(cs.setRelay).not.toHaveBeenCalled();
  });

  test("[positive] menunggu giliran selama telemetry memegang kunci device", async () => {
    const store = useStore();
    let releaseTelemetry;
    cs.pingTelemetry.mockImplementation(() => new Promise((resolve) => { releaseTelemetry = () => resolve({ telemetry: {} }); }));
    cs.setRelay.mockResolvedValue({ data: { stateConfirmed: true } });

    const telemetry = uc.fetchAndStoreTelemetry(store.device());
    const { commandId } = await uc.powerDevice("d1", "on");
    const processing = uc.processRelayCommand(commandId);

    await new Promise((r) => setImmediate(r));
    expect(uc.isDeviceBusy("d1")).toBe(true);
    expect(cs.setRelay).not.toHaveBeenCalled();

    releaseTelemetry();
    await telemetry;
    await processing;
    expect(cs.setRelay).toHaveBeenCalledTimes(1);
    expect(store.log(commandId).status).toBe("success");
  });
});

describe("failRelayCommand & recoverPendingRelayCommands", () => {
  test("[positive] failRelayCommand menandai command pending jadi failed", async () => {
    const store = useStore();
    const { commandId } = await uc.powerDevice("d1", "on");
    await uc.failRelayCommand(commandId, new Error("db down"));
    expect(store.log(commandId)).toMatchObject({ status: "failed", notes: "Proses perintah error: db down" });
  });

  test("[negative] failRelayCommand untuk command tidak ada / sudah selesai -> diabaikan", async () => {
    const store = useStore({ logs: [{ id: "done", deviceId: "d1", status: "success", executedAt: new Date() }] });
    await expect(uc.failRelayCommand("ghost", new Error("x"))).resolves.toBeUndefined();
    await uc.failRelayCommand("done", new Error("x"));
    expect(store.log("done").status).toBe("success");
  });

  test("[positive/negative] recovery memasukkan ulang semua pending; tanpa pending tidak ada log", async () => {
    prisma.commandLog.findMany.mockResolvedValueOnce([{ id: "c1" }, { id: "c2" }]).mockResolvedValueOnce([]);
    await uc.recoverPendingRelayCommands();
    expect(enqueueRelayCommand.mock.calls).toEqual([["c1"], ["c2"]]);
    expect(logger.info).toHaveBeenCalledTimes(1);
    await uc.recoverPendingRelayCommands();
    expect(logger.info).toHaveBeenCalledTimes(1);
  });
});

describe("fetchAndStoreTelemetry & pingDevice", () => {
  test("[positive] lastSeen diperbarui, status disinkron dari relay_state, reading disimpan & event", async () => {
    const store = useStore();
    cs.pingTelemetry.mockResolvedValue({ telemetry: { relay_state: "ON", meter_reading: 205912 } });

    const result = await uc.fetchAndStoreTelemetry(store.device(), { timeout: 5000 });

    expect(cs.pingTelemetry).toHaveBeenCalledWith(DEV_EUI, { timeout: 5000 });
    expect(store.device()).toMatchObject({ status: "on", lastSeenAt: expect.any(Date) });
    expect(prisma.energyReading.create).toHaveBeenCalledWith({ data: { deviceId: "d1", powerWatt: null, usageKwh: 205.912 } });
    // source "telemetry": ini bukti langsung dari uplink meter.
    expect(events.emitDeviceStatus).toHaveBeenCalledWith(expect.objectContaining({ usageKwh: 205.912, status: "on", source: "telemetry" }));
    expect(result.telemetry.relayStatus).toBe("on");
  });

  test("[negative] telemetry tanpa meter_reading & relay_state -> tidak ada reading, status tidak diubah", async () => {
    const store = useStore({ devices: [device({ status: "on" })] });
    cs.pingTelemetry.mockResolvedValue({ telemetry: {} });
    await uc.fetchAndStoreTelemetry(store.device());
    expect(prisma.energyReading.create).not.toHaveBeenCalled();
    expect(store.device().status).toBe("on");
  });

  test("[negative] device sedang memproses perintah lain -> 409 & kunci tidak dilepas pihak lain", async () => {
    const store = useStore();
    let release;
    cs.pingTelemetry.mockImplementationOnce(() => new Promise((r) => { release = () => r({ telemetry: {} }); }));
    const first = uc.fetchAndStoreTelemetry(store.device());
    await expect(uc.fetchAndStoreTelemetry(store.device())).rejects.toMatchObject({ status: 409 });
    expect(uc.isDeviceBusy("d1")).toBe(true);
    release();
    await first;
    expect(uc.isDeviceBusy("d1")).toBe(false);
  });

  test("[negative] ping gagal -> error diteruskan & kunci tetap dilepas", async () => {
    const store = useStore();
    cs.pingTelemetry.mockRejectedValue(httpErr(408));
    await expect(uc.fetchAndStoreTelemetry(store.device())).rejects.toMatchObject({ status: 408 });
    expect(uc.isDeviceBusy("d1")).toBe(false);
  });

  test("[positive/negative] pingDevice: ringkasan hasil & 404/409 dari getLinkedDevice", async () => {
    useStore({ devices: [device(), device({ id: "d2", eui: null })] });
    cs.pingTelemetry.mockResolvedValue({ telemetry: { relay_state: "OFF" } });
    await expect(uc.pingDevice("d1")).resolves.toMatchObject({ deviceId: "d1", devEui: DEV_EUI, status: "off" });
    await expect(uc.pingDevice("x")).rejects.toMatchObject({ status: 404 });
    await expect(uc.pingDevice("d2")).rejects.toMatchObject({ status: 409 });
  });
});

describe("setDeviceInterval", () => {
  test("[positive] sukses -> log success, interval disimpan & event", async () => {
    const store = useStore();
    cs.setReportInterval.mockResolvedValue({ ok: true });
    const result = await uc.setDeviceInterval("d1", { intervalMinutes: "60", userId: "u1" });
    expect(cs.setReportInterval).toHaveBeenCalledWith(DEV_EUI, 3600);
    expect(result).toMatchObject({ intervalMinutes: 60, intervalSeconds: 3600, status: "success" });
    expect(store.log("c1")).toMatchObject({ action: "set_interval:60m", status: "success" });
    expect(store.device().intervalMinutes).toBe(60);
    expect(events.emitDeviceUpdated).toHaveBeenCalled();
  });

  test("[negative] meter tidak merespons -> log failed, interval DB tidak berubah", async () => {
    const store = useStore();
    cs.setReportInterval.mockRejectedValue(new Error("timeout"));
    const result = await uc.setDeviceInterval("d1", { intervalMinutes: 60 });
    expect(result).toMatchObject({ status: "failed", notes: "timeout" });
    expect(store.device().intervalMinutes).toBe(30);
    expect(events.emitDeviceUpdated).not.toHaveBeenCalled();
  });
});

describe("getDeviceTelemetryHistory", () => {
  test("[positive] titik data dalam rentang, dibatasi limit", async () => {
    prisma.device.findUnique.mockResolvedValue(device());
    prisma.energyReading.findMany.mockResolvedValue([{ recordedAt: new Date("2026-09-14T00:00:00Z"), powerWatt: null, usageKwh: 1 }]);
    const result = await uc.getDeviceTelemetryHistory("d1", { from: "2026-09-01", to: "2026-09-14", limit: "50" });
    expect(prisma.energyReading.findMany.mock.calls[0][0].take).toBe(50);
    expect(result.points).toEqual([{ ts: Date.parse("2026-09-14T00:00:00Z"), powerWatt: null, usageKwh: 1 }]);
  });

  test("[negative] device tidak ada -> 404", async () => {
    prisma.device.findUnique.mockResolvedValue(null);
    await expect(uc.getDeviceTelemetryHistory("x", { from: "2026-09-01", to: "2026-09-02" })).rejects.toMatchObject({ status: 404 });
  });

  test.each([
    [{ to: "2026-09-02" }, "wajib diisi"],
    [{ from: "kemarin", to: "2026-09-02" }, "tidak valid"],
    [{ from: "2026-09-05", to: "2026-09-01" }, "tidak boleh lebih besar"],
    [{ from: "2026-01-01", to: "2026-09-01" }, "Rentang maksimal 90 hari"],
  ])("[negative] parameter %j -> 400 (%s)", async (params, message) => {
    prisma.device.findUnique.mockResolvedValue(device());
    await expect(uc.getDeviceTelemetryHistory("d1", params)).rejects.toMatchObject({ status: 400, message: expect.stringContaining(message) });
  });
});

describe("getDeviceChirpstackMetadata & listChirpstackDeviceCandidates", () => {
  test("[positive] metadata dari ChirpStack", async () => {
    prisma.device.findUnique.mockResolvedValue(device());
    cs.getCsDevice.mockResolvedValue({ data: { name: "KwH Meter Master" } });
    await expect(uc.getDeviceChirpstackMetadata("d1")).resolves.toEqual({ deviceId: "d1", devEui: DEV_EUI, attributes: { name: "KwH Meter Master" } });
  });

  test("[negative] device ChirpStack tidak ditemukan -> error diteruskan", async () => {
    prisma.device.findUnique.mockResolvedValue(device());
    cs.getCsDevice.mockRejectedValue(httpErr(404));
    await expect(uc.getDeviceChirpstackMetadata("d1")).rejects.toMatchObject({ status: 404 });
  });

  test("[positive] kandidat ditandai sudah/belum dipetakan ke device EMS", async () => {
    cs.listCsDevices.mockResolvedValue({ data: { totalCount: 2, result: [{ devEui: DEV_EUI, name: "A" }, { devEui: "0800000041000099", name: "B" }] } });
    prisma.device.findMany.mockResolvedValue([{ id: "d1", name: "KwH", eui: DEV_EUI }]);
    const result = await uc.listChirpstackDeviceCandidates();
    expect(result.data).toEqual([
      { devEui: DEV_EUI, name: "A", type: null, isMapped: true, mappedTo: { id: "d1", name: "KwH", eui: DEV_EUI } },
      { devEui: "0800000041000099", name: "B", type: null, isMapped: false, mappedTo: null },
    ]);
    expect(result.totalElements).toBe(2);
  });

  test("[negative] ChirpStack kosong -> tanpa query DB", async () => {
    cs.listCsDevices.mockResolvedValue({ data: { totalCount: 0, result: [] } });
    await expect(uc.listChirpstackDeviceCandidates()).resolves.toMatchObject({ data: [], totalElements: 0 });
    expect(prisma.device.findMany).not.toHaveBeenCalled();
  });
});
