jest.mock("../../../../src/frameworks/webserver/socket-events", () => ({
  emitGatewayCreated: jest.fn(),
  emitGatewayUpdated: jest.fn(),
  emitGatewayDeleted: jest.fn(),
}));

const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const events = require("../../../../src/frameworks/webserver/socket-events");
const gatewayUseCase = require("../../../../src/application/use_cases/gateway/gateway.usecase");
const { resetPrismaMock } = require("../../../helpers/prisma");

const minutesAgo = (m) => new Date(Date.now() - m * 60000);

beforeEach(() => {
  resetPrismaMock(prisma);
  jest.clearAllMocks();
});

describe("listGatewaysPaginated", () => {
  test("[positive] status online kalau ada device yang lastSeen <= 2x interval", async () => {
    prisma.gateway.count.mockResolvedValue(2);
    prisma.gateway.findMany.mockResolvedValue([
      { id: "g1", devices: [{ lastSeenAt: minutesAgo(29), intervalMinutes: 15 }, { lastSeenAt: null, intervalMinutes: 15 }] },
      { id: "g2", devices: [{ lastSeenAt: minutesAgo(31), intervalMinutes: 15 }] },
    ]);

    const result = await gatewayUseCase.listGatewaysPaginated();

    expect(result.data).toEqual([
      { id: "g1", status: "online" },
      { id: "g2", status: "offline" },
    ]);
    expect(result.data[0].devices).toBeUndefined();
    expect(result).toMatchObject({ page: 1, rowsPerPage: 10, totalRows: 2, totalPages: 1 });
  });

  test("[negative] gateway tanpa device -> offline", async () => {
    prisma.gateway.count.mockResolvedValue(1);
    prisma.gateway.findMany.mockResolvedValue([{ id: "g1", devices: [] }]);
    expect((await gatewayUseCase.listGatewaysPaginated()).data[0].status).toBe("offline");
  });

  test("[positive] search di 5 kolom + rentang tanggal + paginasi", async () => {
    prisma.gateway.count.mockResolvedValue(25);
    prisma.gateway.findMany.mockResolvedValue([]);

    const result = await gatewayUseCase.listGatewaysPaginated({
      search: "kerlink",
      createdFrom: "2026-09-01",
      createdTo: "2026-09-30",
      page: 3,
      rowsPerPage: 10,
    });

    const { where, skip } = prisma.gateway.findMany.mock.calls[0][0];
    expect(skip).toBe(20);
    expect(where.AND[0].OR.map((c) => Object.keys(c)[0])).toEqual(["name", "eui", "modelUnit", "simcard", "powerSource"]);
    expect(where.AND[1].createdAt.lte.getHours()).toBe(23);
    expect(result.totalPages).toBe(3);
  });

  test("[positive] hanya createdFrom", async () => {
    prisma.gateway.count.mockResolvedValue(0);
    prisma.gateway.findMany.mockResolvedValue([]);
    await gatewayUseCase.listGatewaysPaginated({ createdFrom: "2026-09-01" });
    expect(prisma.gateway.findMany.mock.calls[0][0].where.AND[0].createdAt).toEqual({ gte: new Date("2026-09-01") });
  });
});

describe("getGatewayById", () => {
  test("[positive] detail dengan status terhitung", async () => {
    prisma.gateway.findUnique.mockResolvedValue({ id: "g1", devices: [{ lastSeenAt: minutesAgo(1), intervalMinutes: 15 }] });
    await expect(gatewayUseCase.getGatewayById("g1")).resolves.toMatchObject({ id: "g1", status: "online" });
  });

  test("[negative] tidak ditemukan -> null", async () => {
    prisma.gateway.findUnique.mockResolvedValue(null);
    await expect(gatewayUseCase.getGatewayById("x")).resolves.toBeNull();
  });
});

describe("createGateway", () => {
  test("[positive] tanggal instalasi jadi Date, installer diset & event dikirim dengan status offline", async () => {
    prisma.gateway.create.mockResolvedValue({ id: "g1", name: "Kerlink" });

    const result = await gatewayUseCase.createGateway({
      eui: "7276ff0045060ffb",
      name: "Kerlink",
      installationDate: "2026-09-01",
      installedById: "u1",
    });

    const { data } = prisma.gateway.create.mock.calls[0][0];
    expect(data.installationDate).toEqual(new Date("2026-09-01"));
    expect(data.installedById).toBe("u1");
    expect(result).toEqual({ id: "g1", name: "Kerlink" });
    expect(events.emitGatewayCreated).toHaveBeenCalledWith({ id: "g1", name: "Kerlink", status: "offline" });
  });

  test("[negative] tanpa tanggal & installer (atau string kosong) -> undefined / null", async () => {
    prisma.gateway.create.mockResolvedValue({ id: "g1" });
    await gatewayUseCase.createGateway({ eui: "e", name: "n", installationDate: "", installedById: "" });
    const { data } = prisma.gateway.create.mock.calls[0][0];
    expect(data.installationDate).toBeUndefined();
    expect(data.installedById).toBeNull();
  });

  test("[negative] EUI duplikat (P2002) -> diteruskan & tidak ada event", async () => {
    prisma.gateway.create.mockRejectedValue(Object.assign(new Error("Unique"), { code: "P2002" }));
    await expect(gatewayUseCase.createGateway({ eui: "e", name: "n" })).rejects.toMatchObject({ code: "P2002" });
    expect(events.emitGatewayCreated).not.toHaveBeenCalled();
  });
});

describe("updateGateway", () => {
  test("[positive] field dikirim diperbarui & event updated", async () => {
    prisma.gateway.update.mockResolvedValue({ id: "g1" });
    await gatewayUseCase.updateGateway("g1", { name: "Baru", installationDate: "2026-09-02", installedById: "u2" });
    const { data } = prisma.gateway.update.mock.calls[0][0];
    expect(data).toMatchObject({ name: "Baru", installationDate: new Date("2026-09-02"), installedById: "u2" });
    expect(events.emitGatewayUpdated).toHaveBeenCalledWith({ id: "g1" });
  });

  test("[positive] installedById string kosong -> null (lepas installer)", async () => {
    prisma.gateway.update.mockResolvedValue({ id: "g1" });
    await gatewayUseCase.updateGateway("g1", { installedById: "" });
    expect(prisma.gateway.update.mock.calls[0][0].data.installedById).toBeNull();
  });

  test("[negative] installedById tidak dikirim -> tidak diubah; EUI tidak bisa diubah lewat update", async () => {
    prisma.gateway.update.mockResolvedValue({ id: "g1" });
    await gatewayUseCase.updateGateway("g1", { eui: "baru", name: "n" });
    const { data } = prisma.gateway.update.mock.calls[0][0];
    expect(data.installedById).toBeUndefined();
    expect(data).not.toHaveProperty("eui");
  });

  test("[negative] gateway tidak ada (P2025) diteruskan tanpa event", async () => {
    prisma.gateway.update.mockRejectedValue(Object.assign(new Error("not found"), { code: "P2025" }));
    await expect(gatewayUseCase.updateGateway("x", {})).rejects.toMatchObject({ code: "P2025" });
    expect(events.emitGatewayUpdated).not.toHaveBeenCalled();
  });
});

describe("deleteGateway", () => {
  test("[positive] tidak punya device -> dihapus & event deleted", async () => {
    prisma.device.count.mockResolvedValue(0);
    prisma.gateway.delete.mockResolvedValue({ id: "g1" });
    await gatewayUseCase.deleteGateway("g1");
    expect(prisma.gateway.delete).toHaveBeenCalledWith({ where: { id: "g1" } });
    expect(events.emitGatewayDeleted).toHaveBeenCalledWith("g1");
  });

  test("[negative] masih punya device -> 409 & tidak dihapus", async () => {
    prisma.device.count.mockResolvedValue(3);
    await expect(gatewayUseCase.deleteGateway("g1")).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("masih memiliki 3 device"),
    });
    expect(prisma.gateway.delete).not.toHaveBeenCalled();
    expect(events.emitGatewayDeleted).not.toHaveBeenCalled();
  });
});
