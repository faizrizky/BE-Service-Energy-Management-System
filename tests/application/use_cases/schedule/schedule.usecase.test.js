jest.mock("../../../../src/frameworks/database/prismaClient", () => ({
  prisma: {
    schedule: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const scheduleUseCase = require("../../../../src/application/use_cases/schedule/schedule.usecase");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("listSchedules", () => {
  test("passing filter roomId ke query", async () => {
    prisma.schedule.findMany.mockResolvedValue([]);
    await scheduleUseCase.listSchedules({ roomId: "room-1" });
    expect(prisma.schedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { roomId: "room-1" } }),
    );
  });

  test("tanpa filter -> roomId undefined", async () => {
    prisma.schedule.findMany.mockResolvedValue([]);
    await scheduleUseCase.listSchedules();
    expect(prisma.schedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { roomId: undefined } }),
    );
  });
});

describe("getScheduleById", () => {
  test("return null kalau gak ketemu (bukan throw)", async () => {
    prisma.schedule.findUnique.mockResolvedValue(null);
    const result = await scheduleUseCase.getScheduleById("id-gak-ada");
    expect(result).toBeNull();
  });
});

describe("createSchedule - conflict detection", () => {
  test("berhasil kalau gak ada schedule lain yang overlap", async () => {
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.schedule.create.mockResolvedValue({ id: "new-1" });

    const result = await scheduleUseCase.createSchedule(
      {
        roomId: "room-1",
        deviceId: "device-1",
        action: "on",
        scheduledDate: "2026-08-23",
        startTime: "10:00",
        endTime: "12:00",
      },
      "user-1",
    );

    expect(result.id).toBe("new-1");
    expect(prisma.schedule.create).toHaveBeenCalled();
  });

  test("[negative] 409 kalau overlap waktu di room & device yang sama", async () => {
    prisma.schedule.findMany.mockResolvedValue([
      {
        id: "existing-1",
        roomId: "room-1",
        deviceId: "device-1",
        scheduledDate: new Date("2026-08-23"),
        startTime: "09:00",
        endTime: "11:00",
        repeatType: "none",
        repeatDays: null,
      },
    ]);

    await expect(
      scheduleUseCase.createSchedule(
        {
          roomId: "room-1",
          deviceId: "device-1",
          action: "on",
          scheduledDate: "2026-08-23",
          startTime: "10:00",
          endTime: "12:00",
        },
        "user-1",
      ),
    ).rejects.toThrow(/Jadwal bentrok/);

    expect(prisma.schedule.create).not.toHaveBeenCalled();
  });

  test("gak conflict kalau room beda, walau waktu sama persis", async () => {
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.schedule.create.mockResolvedValue({ id: "new-2" });

    await scheduleUseCase.createSchedule(
      {
        roomId: "room-2",
        deviceId: "device-1",
        action: "on",
        scheduledDate: "2026-08-23",
        startTime: "10:00",
        endTime: "12:00",
      },
      "user-1",
    );

    expect(prisma.schedule.create).toHaveBeenCalled();
  });

  test("[negative] conflict tetap kedetect walau salah satu deviceId null (room-level vs device-level)", async () => {
    prisma.schedule.findMany.mockResolvedValue([
      {
        id: "existing-1",
        roomId: "room-1",
        deviceId: null,
        scheduledDate: new Date("2026-08-23"),
        startTime: "09:00",
        endTime: "11:00",
        repeatType: "none",
        repeatDays: null,
      },
    ]);

    await expect(
      scheduleUseCase.createSchedule(
        {
          roomId: "room-1",
          deviceId: "device-1",
          action: "on",
          scheduledDate: "2026-08-23",
          startTime: "10:00",
          endTime: "12:00",
        },
        "user-1",
      ),
    ).rejects.toThrow(/Jadwal bentrok/);
  });

  test("[negative] repeatType default 'none' kalau gak diisi", async () => {
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.schedule.create.mockResolvedValue({ id: "new-3" });

    await scheduleUseCase.createSchedule(
      {
        roomId: "room-1",
        action: "on",
        scheduledDate: "2026-08-23",
        startTime: "10:00",
      },
      "user-1",
    );

    expect(prisma.schedule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ repeatType: "none", deviceId: null }),
      }),
    );
  });
});

describe("updateSchedule", () => {
  test("[negative] 404 kalau schedule gak ketemu", async () => {
    prisma.schedule.findUnique.mockResolvedValue(null);
    await expect(
      scheduleUseCase.updateSchedule("id-gak-ada", {}),
    ).rejects.toThrow("Schedule tidak ditemukan");
  });

  test("berhasil update tanpa conflict, merge data lama + baru", async () => {
    prisma.schedule.findUnique.mockResolvedValue({
      id: "sch-1",
      roomId: "room-1",
      deviceId: "device-1",
      scheduledDate: new Date("2026-08-23"),
      startTime: "10:00",
      endTime: "12:00",
      repeatType: "none",
      repeatDays: null,
    });
    prisma.schedule.findMany.mockResolvedValue([]); // gak ada schedule lain yang conflict
    prisma.schedule.update.mockResolvedValue({
      id: "sch-1",
      startTime: "14:00",
    });

    const result = await scheduleUseCase.updateSchedule("sch-1", {
      startTime: "14:00",
      endTime: "16:00",
    });
    expect(result.startTime).toBe("14:00");
  });

  test("[negative] tetap 409 kalau update bikin overlap baru sama schedule lain", async () => {
    prisma.schedule.findUnique.mockResolvedValue({
      id: "sch-2",
      roomId: "room-1",
      deviceId: "device-1",
      scheduledDate: new Date("2026-08-23"),
      startTime: "20:00",
      endTime: "21:00",
      repeatType: "none",
      repeatDays: null,
    });
    prisma.schedule.findMany.mockResolvedValue([
      {
        id: "sch-other",
        roomId: "room-1",
        deviceId: "device-1",
        scheduledDate: new Date("2026-08-23"),
        startTime: "09:00",
        endTime: "11:00",
        repeatType: "none",
        repeatDays: null,
      },
    ]);

    await expect(
      scheduleUseCase.updateSchedule("sch-2", {
        startTime: "10:00",
        endTime: "12:00",
      }),
    ).rejects.toThrow(/Jadwal bentrok/);
  });

  test("excludeId dipakai -> gak conflict sama diri sendiri", async () => {
    prisma.schedule.findUnique.mockResolvedValue({
      id: "sch-3",
      roomId: "room-1",
      deviceId: "device-1",
      scheduledDate: new Date("2026-08-23"),
      startTime: "10:00",
      endTime: "12:00",
      repeatType: "none",
      repeatDays: null,
    });
    prisma.schedule.findMany.mockResolvedValue([]);
    prisma.schedule.update.mockResolvedValue({ id: "sch-3" });

    await scheduleUseCase.updateSchedule("sch-3", { status: "active" });
    expect(prisma.schedule.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { not: "sch-3" } }),
      }),
    );
  });
});

describe("deleteSchedule", () => {
  test("panggil prisma.schedule.delete dengan id yang benar", async () => {
    prisma.schedule.delete.mockResolvedValue({ id: "sch-1" });
    await scheduleUseCase.deleteSchedule("sch-1");
    expect(prisma.schedule.delete).toHaveBeenCalledWith({
      where: { id: "sch-1" },
    });
  });
});
