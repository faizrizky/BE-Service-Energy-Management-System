jest.mock("../../../../src/frameworks/webserver/socket-events", () => ({
  emitScheduleCreated: jest.fn(),
  emitScheduleUpdated: jest.fn(),
  emitScheduleDeleted: jest.fn(),
}));

const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const events = require("../../../../src/frameworks/webserver/socket-events");
const scheduleUseCase = require("../../../../src/application/use_cases/schedule/schedule.usecase");
const { resetPrismaMock } = require("../../../helpers/prisma");

const input = (overrides = {}) => ({
  roomId: "room-1",
  deviceId: "device-1",
  action: "on",
  scheduledDate: "2026-09-20",
  startTime: "10:00",
  endTime: "12:00",
  ...overrides,
});

const existing = (overrides = {}) => ({
  id: "existing-1",
  roomId: "room-1",
  deviceId: "device-1",
  scheduledDate: new Date("2026-09-20"),
  startTime: "09:00",
  endTime: "11:00",
  repeatType: "none",
  repeatDays: null,
  status: "active",
  ...overrides,
});

beforeEach(() => {
  resetPrismaMock(prisma);
  jest.clearAllMocks();
});

describe("listSchedulesPaginated", () => {
  beforeEach(() => {
    prisma.schedule.count.mockResolvedValue(0);
    prisma.schedule.findMany.mockResolvedValue([]);
  });

  test("[positive] tanpa filter -> where kosong, include relasi aman (tanpa passwordHash)", async () => {
    const result = await scheduleUseCase.listSchedulesPaginated();
    const call = prisma.schedule.findMany.mock.calls[0][0];
    expect(call.where).toEqual({});
    expect(call.include.createdBy.select).toEqual({ id: true, fullName: true, username: true, email: true });
    expect(result).toEqual({ data: [], page: 1, rowsPerPage: 10, totalRows: 0, totalPages: 1 });
  });

  test("[positive] status 'upcoming' -> one-time setelah hari ini", async () => {
    await scheduleUseCase.listSchedulesPaginated({ status: "upcoming" });
    const [cond] = prisma.schedule.findMany.mock.calls[0][0].where.AND;
    expect(cond).toMatchObject({ status: "active", repeatType: "none" });
    expect(cond.scheduledDate.gt.getUTCHours()).toBe(0);
  });

  test("[positive] status 'active' -> recurring atau sudah dimulai", async () => {
    await scheduleUseCase.listSchedulesPaginated({ status: "active" });
    const [cond] = prisma.schedule.findMany.mock.calls[0][0].where.AND;
    expect(cond.OR).toEqual([{ repeatType: { not: "none" } }, { scheduledDate: { lte: expect.any(Date) } }]);
  });

  test("[negative] status tidak dikenal diabaikan (bukan error)", async () => {
    await scheduleUseCase.listSchedulesPaginated({ status: "deleted" });
    expect(prisma.schedule.findMany.mock.calls[0][0].where).toEqual({});
  });

  test("[positive] roomId + rentang tanggal + search + paginasi string di-convert ke number", async () => {
    prisma.schedule.count.mockResolvedValue(15);
    const result = await scheduleUseCase.listSchedulesPaginated({
      roomId: "room-1",
      scheduledFrom: "2026-09-01",
      scheduledTo: "2026-09-30",
      search: "AC",
      page: "2",
      rowsPerPage: "10",
    });
    const { where, skip } = prisma.schedule.findMany.mock.calls[0][0];
    expect(where.AND[0]).toEqual({ roomId: "room-1" });
    expect(where.AND[1].scheduledDate.lte.getHours()).toBe(23);
    expect(where.AND[2].OR).toHaveLength(4);
    expect(skip).toBe(10);
    expect(result).toMatchObject({ page: 2, rowsPerPage: 10, totalPages: 2 });
  });
});

describe("getScheduleById", () => {
  test("[positive/negative] ditemukan & null", async () => {
    prisma.schedule.findUnique.mockResolvedValueOnce({ id: "s1" }).mockResolvedValueOnce(null);
    await expect(scheduleUseCase.getScheduleById("s1")).resolves.toEqual({ id: "s1" });
    await expect(scheduleUseCase.getScheduleById("x")).resolves.toBeNull();
  });
});

describe("createSchedule", () => {
  test("[positive] tanpa bentrok -> dibuat dengan default & event dikirim", async () => {
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.schedule.create.mockResolvedValue({ id: "new" });

    await scheduleUseCase.createSchedule(input({ deviceId: "", endTime: "" }), "user-1");

    expect(prisma.schedule.findMany).toHaveBeenCalledWith({ where: { status: "active", roomId: "room-1" } });
    expect(prisma.schedule.create).toHaveBeenCalledWith({
      data: {
        roomId: "room-1",
        deviceId: null,
        action: "on",
        scheduledDate: new Date("2026-09-20"),
        startTime: "10:00",
        endTime: null,
        repeatType: "none",
        repeatDays: undefined,
        createdById: "user-1",
      },
    });
    expect(events.emitScheduleCreated).toHaveBeenCalledWith({ id: "new" });
  });

  test("[negative] overlap jam di device yang sama -> 409 & tidak dibuat", async () => {
    prisma.schedule.findMany.mockResolvedValue([existing()]);
    await expect(scheduleUseCase.createSchedule(input(), "u1")).rejects.toMatchObject({
      status: 409,
      message: "Jadwal bentrok dengan schedule lain (id: existing-1, 09:00-11:00)",
    });
    expect(prisma.schedule.create).not.toHaveBeenCalled();
    expect(events.emitScheduleCreated).not.toHaveBeenCalled();
  });

  test("[negative] jadwal level room bentrok dengan jadwal level device", async () => {
    prisma.schedule.findMany.mockResolvedValue([existing({ deviceId: null })]);
    await expect(scheduleUseCase.createSchedule(input(), "u1")).rejects.toMatchObject({ status: 409 });
  });

  test("[negative] bentrok dengan jadwal harian yang dimulai lebih awal", async () => {
    prisma.schedule.findMany.mockResolvedValue([
      existing({ repeatType: "daily", scheduledDate: new Date("2026-09-01") }),
    ]);
    await expect(scheduleUseCase.createSchedule(input(), "u1")).rejects.toMatchObject({ status: 409 });
  });

  test("[negative] bentrok lintas tengah malam (23:00-01:00 vs 00:30)", async () => {
    prisma.schedule.findMany.mockResolvedValue([existing({ startTime: "23:00", endTime: "01:00" })]);
    await expect(
      scheduleUseCase.createSchedule(input({ scheduledDate: "2026-09-21", startTime: "00:30", endTime: null }), "u1"),
    ).rejects.toMatchObject({ status: 409 });
  });

  test("[negative] pesan 409 tanpa endTime hanya menampilkan jam mulai", async () => {
    prisma.schedule.findMany.mockResolvedValue([existing({ startTime: "10:00", endTime: null })]);
    await expect(scheduleUseCase.createSchedule(input({ endTime: null }), "u1")).rejects.toThrow("(id: existing-1, 10:00)");
  });

  test.each([
    ["device berbeda di room yang sama", existing({ deviceId: "device-2" })],
    ["jam bersebelahan tidak beririsan", existing({ startTime: "12:01", endTime: "13:00" })],
    ["tanggal berbeda", existing({ scheduledDate: new Date("2026-09-21") })],
    ["weekly di hari lain", existing({ repeatType: "weekly", repeatDays: [1], scheduledDate: new Date("2026-09-01") })],
  ])("[positive] tidak bentrok: %s", async (_, other) => {
    prisma.schedule.findMany.mockResolvedValue([other]);
    prisma.schedule.create.mockResolvedValue({ id: "ok" });
    // 2026-09-20 adalah hari Minggu (0)
    await expect(scheduleUseCase.createSchedule(input(), "u1")).resolves.toEqual({ id: "ok" });
  });
});

describe("updateSchedule", () => {
  test("[negative] schedule tidak ditemukan -> 404", async () => {
    prisma.schedule.findUnique.mockResolvedValue(null);
    await expect(scheduleUseCase.updateSchedule("x", {})).rejects.toMatchObject({ status: 404 });
  });

  test("[positive] data lama digabung dengan data baru untuk cek bentrok & diri sendiri dikecualikan", async () => {
    prisma.schedule.findUnique.mockResolvedValue(existing({ id: "s1" }));
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.schedule.update.mockResolvedValue({ id: "s1" });

    await scheduleUseCase.updateSchedule("s1", { startTime: "14:00", endTime: "15:00", status: "completed" });

    expect(prisma.schedule.findMany).toHaveBeenCalledWith({
      where: { status: "active", roomId: "room-1", id: { not: "s1" } },
    });
    expect(prisma.schedule.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: expect.objectContaining({ startTime: "14:00", endTime: "15:00", status: "completed", scheduledDate: undefined }),
    });
    expect(events.emitScheduleUpdated).toHaveBeenCalledWith({ id: "s1" });
  });

  test("[negative] perubahan jam membuat bentrok baru -> 409 tanpa update", async () => {
    prisma.schedule.findUnique.mockResolvedValue(existing({ id: "s2", startTime: "20:00", endTime: "21:00" }));
    prisma.schedule.findMany.mockResolvedValue([existing({ id: "other" })]);
    await expect(scheduleUseCase.updateSchedule("s2", { startTime: "10:00", endTime: "12:00" })).rejects.toMatchObject({ status: 409 });
    expect(prisma.schedule.update).not.toHaveBeenCalled();
  });

  test("[positive] endTime null eksplisit menghapus jam selesai", async () => {
    prisma.schedule.findUnique.mockResolvedValue(existing({ id: "s1" }));
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.schedule.update.mockResolvedValue({ id: "s1" });
    await scheduleUseCase.updateSchedule("s1", { endTime: null });
    expect(prisma.schedule.update.mock.calls[0][0].data.endTime).toBeNull();
  });

  // create mengubah "" menjadi null, update meneruskan "" apa adanya -> FK error / data tidak konsisten.
  test.failing("[BUG] deviceId string kosong saat update seharusnya disimpan sebagai null", async () => {
    prisma.schedule.findUnique.mockResolvedValue(existing({ id: "s1" }));
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.schedule.update.mockResolvedValue({ id: "s1" });
    await scheduleUseCase.updateSchedule("s1", { deviceId: "", endTime: "" });
    expect(prisma.schedule.update.mock.calls[0][0].data).toMatchObject({ deviceId: null, endTime: null });
  });
});

describe("deleteSchedule", () => {
  test("[positive] dihapus & event dikirim", async () => {
    prisma.schedule.delete.mockResolvedValue({ id: "s1" });
    await scheduleUseCase.deleteSchedule("s1");
    expect(prisma.schedule.delete).toHaveBeenCalledWith({ where: { id: "s1" } });
    expect(events.emitScheduleDeleted).toHaveBeenCalledWith("s1");
  });

  test("[negative] tidak ada (P2025) -> error diteruskan tanpa event", async () => {
    prisma.schedule.delete.mockRejectedValue(Object.assign(new Error("not found"), { code: "P2025" }));
    await expect(scheduleUseCase.deleteSchedule("x")).rejects.toMatchObject({ code: "P2025" });
    expect(events.emitScheduleDeleted).not.toHaveBeenCalled();
  });
});
