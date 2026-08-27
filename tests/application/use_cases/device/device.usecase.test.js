jest.mock("../../../../src/frameworks/database/prismaClient", () => ({
  prisma: {
    device: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    commandLog: { create: jest.fn() },
  },
}));

jest.mock("../../../../src/frameworks/thingsboard/client", () => ({
  sendRelayCommandConfirmed: jest.fn(),
}));

const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const {
  sendRelayCommandConfirmed,
} = require("../../../../src/frameworks/thingsboard/client");
const deviceUseCase = require("../../../../src/application/use_cases/device/device.usecase");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createDevice", () => {
  test("default intervalMinutes 5 & tbDeviceId null kalau gak diisi", async () => {
    prisma.device.create.mockResolvedValue({ id: "d1" });
    await deviceUseCase.createDevice({
      eui: "EUI-1",
      name: "AC",
      roomId: "r1",
      gatewayId: "g1",
    });

    expect(prisma.device.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ intervalMinutes: 5, tbDeviceId: null }),
    });
  });
});

describe("powerDevice", () => {
  test("[negative] 404 kalau device gak ketemu", async () => {
    prisma.device.findUnique.mockResolvedValue(null);
    await expect(deviceUseCase.powerDevice("d-gak-ada", "on")).rejects.toThrow(
      "Device tidak ditemukan",
    );
  });

  test("[negative] 409 kalau tbDeviceId kosong", async () => {
    prisma.device.findUnique.mockResolvedValue({ id: "d1", tbDeviceId: null });
    await expect(deviceUseCase.powerDevice("d1", "on")).rejects.toThrow(
      /tbDeviceId kosong/,
    );
    expect(sendRelayCommandConfirmed).not.toHaveBeenCalled();
  });

  test("sukses: sendRelayCommandConfirmed berhasil -> status success, device di-update", async () => {
    prisma.device.findUnique.mockResolvedValue({
      id: "d1",
      roomId: "r1",
      tbDeviceId: "tb-1",
    });
    sendRelayCommandConfirmed.mockResolvedValue({});
    prisma.commandLog.create.mockResolvedValue({});
    prisma.device.update.mockResolvedValue({});

    const result = await deviceUseCase.powerDevice("d1", "on", {
      userId: "u1",
    });

    expect(result.status).toBe("success");
    expect(prisma.device.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { status: "on" },
    });
    expect(prisma.commandLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          triggerType: "manual",
          triggeredByUserId: "u1",
        }),
      }),
    );
  });

  test("[negative] sendRelayCommandConfirmed gagal -> status failed, device TIDAK di-update, notes berisi error", async () => {
    prisma.device.findUnique.mockResolvedValue({
      id: "d1",
      roomId: "r1",
      tbDeviceId: "tb-1",
    });
    sendRelayCommandConfirmed.mockRejectedValue(
      new Error("Connection refused"),
    );
    prisma.commandLog.create.mockResolvedValue({});

    const result = await deviceUseCase.powerDevice("d1", "on");

    expect(result.status).toBe("failed");
    expect(result.notes).toBe("Connection refused");
    expect(prisma.device.update).not.toHaveBeenCalled();
  });

  test("triggerType 'scheduled' kalau scheduleId dikasih (bukan userId)", async () => {
    prisma.device.findUnique.mockResolvedValue({
      id: "d1",
      roomId: "r1",
      tbDeviceId: "tb-1",
    });
    sendRelayCommandConfirmed.mockResolvedValue({});
    prisma.commandLog.create.mockResolvedValue({});
    prisma.device.update.mockResolvedValue({});

    await deviceUseCase.powerDevice("d1", "off", { scheduleId: "sch-1" });

    expect(prisma.commandLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          triggerType: "scheduled",
          triggeredByUserId: null,
          scheduleId: "sch-1",
        }),
      }),
    );
  });
});
