jest.mock("../../../../src/frameworks/database/prismaClient", () => ({
  prisma: {
    room: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    device: { findMany: jest.fn(), update: jest.fn() },
    commandLog: { create: jest.fn() },
  },
}));

jest.mock("../../../../src/frameworks/thingsboard/client", () => ({
  sendRelayCommand: jest.fn(),
}));

const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const {
  sendRelayCommand,
} = require("../../../../src/frameworks/thingsboard/client");
const roomUseCase = require("../../../../src/application/use_cases/room/room.usecase");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createRoom", () => {
  test("isCritical default false kalau gak diisi", async () => {
    prisma.room.create.mockResolvedValue({ id: "r1" });
    await roomUseCase.createRoom({ name: "Ruang Server" });
    expect(prisma.room.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isCritical: false }),
      }),
    );
  });
});

describe("powerRoom", () => {
  test("[negative] 404 kalau room gak ketemu", async () => {
    prisma.room.findUnique.mockResolvedValue(null);
    await expect(roomUseCase.powerRoom("r-gak-ada", "on")).rejects.toThrow(
      "Room tidak ditemukan",
    );
  });

  test("room tanpa device -> results kosong, gak error", async () => {
    prisma.room.findUnique.mockResolvedValue({ id: "r1", devices: [] });
    const result = await roomUseCase.powerRoom("r1", "on");
    expect(result.results).toEqual([]);
  });

  test("[negative] mixed result - 1 device sukses, 1 device gagal (tbDeviceId kosong)", async () => {
    prisma.room.findUnique.mockResolvedValue({
      id: "r1",
      devices: [
        { id: "d1", tbDeviceId: "tb-1" },
        { id: "d2", tbDeviceId: null },
      ],
    });
    sendRelayCommand.mockResolvedValue({});
    prisma.commandLog.create.mockResolvedValue({});
    prisma.device.update.mockResolvedValue({});

    const result = await roomUseCase.powerRoom("r1", "on", { userId: "u1" });

    expect(result.results).toHaveLength(2);
    expect(result.results.find((r) => r.deviceId === "d1").status).toBe(
      "success",
    );
    expect(result.results.find((r) => r.deviceId === "d2").status).toBe(
      "failed",
    );
    expect(result.results.find((r) => r.deviceId === "d2").notes).toMatch(
      /tbDeviceId kosong/,
    );

    expect(prisma.device.update).toHaveBeenCalledTimes(1);
    expect(prisma.device.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { status: "on" },
    });
  });

  test("[negative] sendRelayCommand throw untuk salah satu device -> tetap lanjut proses device lain", async () => {
    prisma.room.findUnique.mockResolvedValue({
      id: "r1",
      devices: [
        { id: "d1", tbDeviceId: "tb-1" },
        { id: "d2", tbDeviceId: "tb-2" },
      ],
    });
    sendRelayCommand
      .mockRejectedValueOnce(new Error("Timeout"))
      .mockResolvedValueOnce({});
    prisma.commandLog.create.mockResolvedValue({});
    prisma.device.update.mockResolvedValue({});

    const result = await roomUseCase.powerRoom("r1", "on");

    expect(result.results[0].status).toBe("failed");
    expect(result.results[0].notes).toBe("Timeout");
    expect(result.results[1].status).toBe("success");
    expect(prisma.device.update).toHaveBeenCalledTimes(1);
  });
});
