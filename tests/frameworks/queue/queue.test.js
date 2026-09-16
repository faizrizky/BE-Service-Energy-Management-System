jest.mock("../../../src/application/use_cases/device/device.usecase", () => ({
  fetchAndStoreTelemetry: jest.fn(),
  isDeviceBusy: jest.fn(),
  powerDevice: jest.fn(),
}));
jest.mock("../../../src/application/use_cases/report/report.usecase", () => ({
  pruneOldReadings: jest.fn(),
}));

const { prisma } = require("../../../src/frameworks/database/prismaClient");
const logger = require("../../../src/frameworks/helpers/logger");
const deviceUseCase = require("../../../src/application/use_cases/device/device.usecase");
const { pruneOldReadings } = require("../../../src/application/use_cases/report/report.usecase");
const { resetPrismaMock } = require("../../helpers/prisma");

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  resetPrismaMock(prisma);
  jest.clearAllMocks();
});

describe("relayCommandQueue", () => {
  const { relayCommandQueue, enqueueRelayCommand, startRelayCommandWorker } = require("../../../src/frameworks/queue/relayCommandQueue");

  test("[positive] enqueue memakai jobId = commandId (idempoten) dengan retry & auto cleanup", async () => {
    await enqueueRelayCommand("c1");
    expect(relayCommandQueue.name).toBe("relay-command");
    expect(relayCommandQueue.add).toHaveBeenCalledWith(
      "execute",
      { commandId: "c1" },
      { jobId: "c1", attempts: 3, backoff: { type: "fixed", delay: 10000 }, removeOnComplete: true, removeOnFail: true },
    );
  });

  test("[negative] Redis gagal saat enqueue -> error diteruskan", async () => {
    relayCommandQueue.add.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    await expect(enqueueRelayCommand("c1")).rejects.toThrow("ECONNREFUSED");
  });

  test("[positive] worker memanggil processor dengan commandId & konfigurasi concurrency", async () => {
    const processor = jest.fn().mockResolvedValue("done");
    const worker = startRelayCommandWorker(processor);
    await expect(worker.processor({ data: { commandId: "c9" } })).resolves.toBe("done");
    expect(processor).toHaveBeenCalledWith("c9");
    expect(worker.opts).toMatchObject({ concurrency: 50, maxStalledCount: 10 });
  });

  test("[positive] onFailed dipanggil hanya setelah attempt terakhir", () => {
    const onFailed = jest.fn();
    const worker = startRelayCommandWorker(jest.fn(), { onFailed });
    const err = new Error("db down");
    worker.handlers.failed({ id: "c1", data: { commandId: "c1" }, attemptsMade: 1, opts: { attempts: 3 } }, err);
    expect(onFailed).not.toHaveBeenCalled();
    worker.handlers.failed({ id: "c1", data: { commandId: "c1" }, attemptsMade: 3, opts: { attempts: 3 } }, err);
    expect(onFailed).toHaveBeenCalledWith("c1", err);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  test("[negative] job undefined atau tanpa onFailed -> hanya log, tidak crash", () => {
    const worker = startRelayCommandWorker(jest.fn());
    expect(() => worker.handlers.failed(undefined, new Error("x"))).not.toThrow();
    expect(() => worker.handlers.failed({ data: {}, attemptsMade: 1, opts: {} }, new Error("x"))).not.toThrow();
  });
});

describe("telemetryPollerJob", () => {
  let poller;
  let intervalSpy;

  beforeEach(() => {
    jest.isolateModules(() => {
      poller = require("../../../src/frameworks/queue/telemetryPollerJob");
    });
    intervalSpy = jest.spyOn(global, "setInterval").mockReturnValue(123);
    deviceUseCase.isDeviceBusy.mockReturnValue(false);
    deviceUseCase.fetchAndStoreTelemetry.mockResolvedValue({});
  });

  afterEach(() => intervalSpy.mockRestore());

  const minutesAgo = (m) => new Date(Date.now() - m * 60000);

  test("[positive] hanya device yang jatuh tempo & tidak sibuk yang di-poll", async () => {
    prisma.device.findMany.mockResolvedValue([
      { id: "never", lastSeenAt: null, intervalMinutes: 30 },
      { id: "due", lastSeenAt: minutesAgo(31), intervalMinutes: 30 },
      { id: "fresh", lastSeenAt: minutesAgo(5), intervalMinutes: 30 },
      { id: "busy", lastSeenAt: null, intervalMinutes: 30 },
    ]);
    deviceUseCase.isDeviceBusy.mockImplementation((id) => id === "busy");

    await poller.runTick();

    expect(prisma.device.findMany).toHaveBeenCalledWith({ where: { eui: { not: "" } } });
    expect(deviceUseCase.fetchAndStoreTelemetry.mock.calls.map(([d]) => d.id)).toEqual(["never", "due"]);
    expect(deviceUseCase.fetchAndStoreTelemetry).toHaveBeenCalledWith(expect.any(Object), { timeout: 120000 });
  });

  test("[negative] satu device gagal -> dicatat & device lain tetap di-poll", async () => {
    prisma.device.findMany.mockResolvedValue([
      { id: "a", name: "A", lastSeenAt: null, intervalMinutes: 15 },
      { id: "b", name: "B", lastSeenAt: null, intervalMinutes: 15 },
    ]);
    deviceUseCase.fetchAndStoreTelemetry.mockRejectedValueOnce(new Error("timeout")).mockResolvedValueOnce({});
    await poller.runTick();
    expect(deviceUseCase.fetchAndStoreTelemetry).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Gagal poll "A"'));
  });

  test("[negative] tick masih berjalan -> tick berikutnya dilewati", async () => {
    let release;
    prisma.device.findMany.mockImplementation(() => new Promise((r) => { release = () => r([]); }));
    const first = poller.runTick();
    await poller.runTick();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("skip tick"));
    expect(prisma.device.findMany).toHaveBeenCalledTimes(1);
    release();
    await first;
    prisma.device.findMany.mockResolvedValue([]);
    await poller.runTick();
    expect(prisma.device.findMany).toHaveBeenCalledTimes(2);
  });

  test("[negative] query DB gagal -> flag running tetap dilepas", async () => {
    prisma.device.findMany.mockRejectedValueOnce(new Error("db down")).mockResolvedValueOnce([]);
    await expect(poller.runTick()).rejects.toThrow("db down");
    await expect(poller.runTick()).resolves.toBeUndefined();
  });

  test("[positive] start menjalankan tick langsung & tiap 1 menit", async () => {
    prisma.device.findMany.mockResolvedValue([]);
    expect(poller.startTelemetryPoller()).toBe(123);
    await flush();
    expect(prisma.device.findMany).toHaveBeenCalledTimes(1);
    expect(intervalSpy).toHaveBeenCalledWith(poller.runTick, 60000);
  });
});

describe("retentionJob", () => {
  let intervalSpy;
  const { startRetentionJob } = require("../../../src/frameworks/queue/retentionJob");

  beforeEach(() => {
    intervalSpy = jest.spyOn(global, "setInterval").mockReturnValue(1);
  });
  afterEach(() => intervalSpy.mockRestore());

  test("[positive] pruning langsung jalan & dijadwalkan harian; ada yang dihapus -> log", async () => {
    pruneOldReadings.mockResolvedValue({ deletedCount: 5, cutoff: new Date("2026-06-16") });
    startRetentionJob();
    await flush();
    expect(pruneOldReadings).toHaveBeenCalledTimes(1);
    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 86400000);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("Hapus 5 energy_readings"));
  });

  test("[negative] tidak ada yang dihapus -> tidak log hapus; error -> dicatat tanpa crash", async () => {
    pruneOldReadings.mockResolvedValueOnce({ deletedCount: 0, cutoff: new Date() });
    startRetentionJob();
    await flush();
    expect(logger.info).not.toHaveBeenCalledWith(expect.stringContaining("Hapus"));

    pruneOldReadings.mockRejectedValueOnce(new Error("db down"));
    startRetentionJob();
    await flush();
    expect(logger.error).toHaveBeenCalledWith("[Retention] Gagal jalanin pruning:", "db down");
  });
});

describe("scheduleQueue", () => {
  let intervalSpy;
  let tick;

  beforeEach(() => {
    intervalSpy = jest.spyOn(global, "setInterval").mockImplementation((fn) => {
      tick = fn;
      return 1;
    });
  });
  afterEach(() => intervalSpy.mockRestore());

  test("[positive] job pertama langsung ditambahkan & tiap menit berikutnya", async () => {
    const { initRepeatableJob, scheduleQueue } = require("../../../src/frameworks/queue/scheduleQueue");
    await initRepeatableJob();
    expect(scheduleQueue.add).toHaveBeenCalledWith("check-due-schedules", {});
    expect(intervalSpy).toHaveBeenCalledWith(expect.any(Function), 60000);
    tick();
    expect(scheduleQueue.add).toHaveBeenCalledTimes(2);
  });

  test("[negative] gagal menambah job -> dicatat, tidak crash", async () => {
    const { initRepeatableJob, scheduleQueue } = require("../../../src/frameworks/queue/scheduleQueue");
    scheduleQueue.add.mockRejectedValue(new Error("redis down"));
    await initRepeatableJob();
    tick();
    await flush();
    expect(logger.error).toHaveBeenCalledWith("[Scheduler] Gagal add job awal:", "redis down");
    expect(logger.error).toHaveBeenCalledWith("[Scheduler] Gagal add job:", "redis down");
  });
});

describe("scheduleWorker", () => {
  let worker;

  // 2026-09-14 (Senin) 08:00:30 WIB
  const at = (hh, mm, ss = 30) => new Date(2026, 8, 14, hh, mm, ss);

  function setNow(date) {
    jest.setSystemTime(date);
  }

  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "setTimeout", "setInterval", "queueMicrotask"] });
    jest.isolateModules(() => {
      worker = require("../../../src/frameworks/queue/scheduleWorker");
    });
    deviceUseCase.powerDevice.mockResolvedValue({});
    prisma.schedule.update.mockResolvedValue({});
  });

  afterEach(() => jest.useRealTimers());

  const schedule = (overrides = {}) => ({
    id: "s1",
    action: "on",
    startTime: "08:00",
    endTime: null,
    repeatType: "daily",
    repeatDays: null,
    scheduledDate: new Date("2026-09-01"),
    device: { id: "d1" },
    room: { devices: [{ id: "d1" }, { id: "d2" }] },
    ...overrides,
  });

  test("[positive] start trigger device-level -> perintah action ke device itu", async () => {
    setNow(at(8, 0));
    prisma.schedule.findMany.mockResolvedValue([schedule()]);
    await worker.executeDueSchedules();
    expect(prisma.schedule.findMany.mock.calls[0][0].where).toEqual({ status: "active", OR: [{ startTime: "08:00" }, { endTime: "08:00" }] });
    expect(deviceUseCase.powerDevice).toHaveBeenCalledWith("d1", "on", { scheduleId: "s1" });
    expect(prisma.schedule.update).not.toHaveBeenCalled();
  });

  test("[positive] schedule level room -> semua device di room", async () => {
    setNow(at(8, 0));
    prisma.schedule.findMany.mockResolvedValue([schedule({ device: null })]);
    await worker.executeDueSchedules();
    expect(deviceUseCase.powerDevice.mock.calls.map((c) => c[0])).toEqual(["d1", "d2"]);
  });

  test("[positive] end trigger -> action dibalik & one-time ditandai completed", async () => {
    setNow(at(17, 0));
    prisma.schedule.findMany.mockResolvedValue([
      schedule({ endTime: "17:00", repeatType: "none", scheduledDate: new Date("2026-09-14") }),
    ]);
    await worker.executeDueSchedules();
    expect(deviceUseCase.powerDevice).toHaveBeenCalledWith("d1", "off", { scheduleId: "s1" });
    expect(prisma.schedule.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { status: "completed" } });
  });

  test("[positive] one-time tanpa endTime selesai saat start trigger", async () => {
    setNow(at(8, 0));
    prisma.schedule.findMany.mockResolvedValue([schedule({ repeatType: "none", scheduledDate: new Date("2026-09-14") })]);
    await worker.executeDueSchedules();
    expect(prisma.schedule.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { status: "completed" } });
  });

  test("[negative] kandidat tidak jatuh tempo hari ini (weekly hari lain) -> tidak ada perintah", async () => {
    setNow(at(8, 0));
    prisma.schedule.findMany.mockResolvedValue([schedule({ repeatType: "weekly", repeatDays: [3] })]);
    await worker.executeDueSchedules();
    expect(deviceUseCase.powerDevice).not.toHaveBeenCalled();
  });

  test("[negative] satu device gagal -> device lain tetap diproses & status tetap diperbarui", async () => {
    setNow(at(8, 0));
    prisma.schedule.findMany.mockResolvedValue([schedule({ device: null, repeatType: "none", scheduledDate: new Date("2026-09-14") })]);
    deviceUseCase.powerDevice.mockRejectedValueOnce(Object.assign(new Error("sibuk"), { status: 409 }));
    await worker.executeDueSchedules();
    expect(deviceUseCase.powerDevice).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("gagal untuk device d1: sibuk"));
    expect(prisma.schedule.update).toHaveBeenCalled();
  });

  test("[positive] catch-up menit yang terlewat sejak pengecekan terakhir", async () => {
    prisma.schedule.findMany.mockResolvedValue([]);
    setNow(at(8, 0));
    await worker.executeDueSchedules();
    setNow(at(8, 3));
    await worker.executeDueSchedules();
    const times = prisma.schedule.findMany.mock.calls.map((c) => c[0].where.OR[0].startTime);
    expect(times).toEqual(["08:00", "08:01", "08:02", "08:03"]);
  });

  test("[negative] downtime panjang -> catch-up dipotong 5 menit terakhir", async () => {
    prisma.schedule.findMany.mockResolvedValue([]);
    setNow(at(8, 0));
    await worker.executeDueSchedules();
    setNow(at(9, 0));
    await worker.executeDueSchedules();
    const times = prisma.schedule.findMany.mock.calls.slice(1).map((c) => c[0].where.OR[0].startTime);
    expect(times).toEqual(["08:56", "08:57", "08:58", "08:59", "09:00"]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Catch-up 60 menit"));
  });

  test("[negative] dua pengecekan di menit yang sama -> menit itu tidak dieksekusi dua kali", async () => {
    prisma.schedule.findMany.mockResolvedValue([]);
    setNow(at(8, 0, 5));
    await worker.executeDueSchedules();
    setNow(at(8, 0, 50));
    await worker.executeDueSchedules();
    expect(prisma.schedule.findMany).toHaveBeenCalledTimes(1);
  });

  test("[positive] jam dicek di SCHEDULE_TIMEZONE, bukan zona waktu server", async () => {
    const previous = process.env.SCHEDULE_TIMEZONE;
    process.env.SCHEDULE_TIMEZONE = "UTC";
    try {
      jest.isolateModules(() => {
        worker = require("../../../src/frameworks/queue/scheduleWorker");
      });
      // 08:00 WIB (TZ proses) = 01:00 UTC
      setNow(at(8, 0));
      prisma.schedule.findMany.mockResolvedValue([schedule({ startTime: "01:00" })]);
      await worker.executeDueSchedules();
      expect(prisma.schedule.findMany.mock.calls[0][0].where.OR).toEqual([{ startTime: "01:00" }, { endTime: "01:00" }]);
      expect(deviceUseCase.powerDevice).toHaveBeenCalledWith("d1", "on", { scheduleId: "s1" });
    } finally {
      if (previous === undefined) delete process.env.SCHEDULE_TIMEZONE;
      else process.env.SCHEDULE_TIMEZONE = previous;
    }
  });

  test("[positive] startScheduleWorker mendaftarkan worker & handler failed", () => {
    const w = worker.startScheduleWorker();
    expect(w.name).toBe("schedule-executor");
    w.handlers.failed({}, new Error("boom"));
    expect(logger.error).toHaveBeenCalledWith("[Scheduler] Job gagal:", "boom");
  });
});
