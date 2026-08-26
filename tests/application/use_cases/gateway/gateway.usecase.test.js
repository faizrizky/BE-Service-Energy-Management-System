jest.mock("../../../../src/frameworks/database/prismaClient", () => ({
  prisma: {
    gateway: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const gatewayUseCase = require("../../../../src/application/use_cases/gateway/gateway.usecase");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createGateway", () => {
  test("installationDate di-convert ke Date object kalau diisi", async () => {
    prisma.gateway.create.mockResolvedValue({ id: "g1" });
    await gatewayUseCase.createGateway({
      eui: "GW-1",
      name: "Gateway 1",
      installationDate: "2026-01-01",
    });

    const callArg = prisma.gateway.create.mock.calls[0][0];
    expect(callArg.data.installationDate).toBeInstanceOf(Date);
  });

  test("[negative] installationDate undefined kalau gak diisi (bukan Invalid Date)", async () => {
    prisma.gateway.create.mockResolvedValue({ id: "g1" });
    await gatewayUseCase.createGateway({ eui: "GW-1", name: "Gateway 1" });

    const callArg = prisma.gateway.create.mock.calls[0][0];
    expect(callArg.data.installationDate).toBeUndefined();
  });

  test("installedById diisi -> ikut ke data create", async () => {
    prisma.gateway.create.mockResolvedValue({ id: "g1" });
    await gatewayUseCase.createGateway({
      eui: "GW-1",
      name: "Gateway 1",
      installedById: "user-1",
    });

    expect(prisma.gateway.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ installedById: "user-1" }),
      }),
    );
  });

  test("[negative] installedById gak diisi -> null (bukan undefined, biar eksplisit gak ada installer)", async () => {
    prisma.gateway.create.mockResolvedValue({ id: "g1" });
    await gatewayUseCase.createGateway({ eui: "GW-1", name: "Gateway 1" });

    expect(prisma.gateway.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ installedById: null }),
      }),
    );
  });
});

describe("updateGateway", () => {
  test("installedById diisi -> ikut ke data update", async () => {
    prisma.gateway.update.mockResolvedValue({ id: "g1" });
    await gatewayUseCase.updateGateway("g1", { installedById: "user-2" });

    expect(prisma.gateway.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ installedById: "user-2" }),
      }),
    );
  });

  test("[negative] installedById gak dikirim sama sekali (undefined) -> gak diubah", async () => {
    prisma.gateway.update.mockResolvedValue({ id: "g1" });
    await gatewayUseCase.updateGateway("g1", { name: "Updated" });

    const callArg = prisma.gateway.update.mock.calls[0][0];
    expect(callArg.data.installedById).toBeUndefined();
  });

  test("installedById dikirim string kosong -> di-treat null (lepas installer)", async () => {
    prisma.gateway.update.mockResolvedValue({ id: "g1" });
    await gatewayUseCase.updateGateway("g1", { installedById: "" });

    expect(prisma.gateway.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ installedById: null }),
      }),
    );
  });
});

describe("listGatewaysPaginated", () => {
  test("pakai default page=1, rowsPerPage=10 kalau gak dikasih", async () => {
    prisma.gateway.count.mockResolvedValue(0);
    prisma.gateway.findMany.mockResolvedValue([]);

    const result = await gatewayUseCase.listGatewaysPaginated();

    expect(result).toEqual({
      data: [],
      page: 1,
      rowsPerPage: 10,
      totalRows: 0,
      totalPages: 1,
    });
    expect(prisma.gateway.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 10 }),
    );
  });

  test("skip dihitung dari page & rowsPerPage", async () => {
    prisma.gateway.count.mockResolvedValue(25);
    prisma.gateway.findMany.mockResolvedValue([]);

    const result = await gatewayUseCase.listGatewaysPaginated({
      page: 3,
      rowsPerPage: 10,
    });

    expect(prisma.gateway.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
    expect(result.totalPages).toBe(3);
  });

  test("search dicari di name & eui (case-insensitive)", async () => {
    prisma.gateway.count.mockResolvedValue(0);
    prisma.gateway.findMany.mockResolvedValue([]);

    await gatewayUseCase.listGatewaysPaginated({ search: "pimpinan" });

    expect(prisma.gateway.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { name: { contains: "pimpinan", mode: "insensitive" } },
          { eui: { contains: "pimpinan", mode: "insensitive" } },
        ],
      },
    });
  });

  test("[negative] totalRows 0 -> totalPages tetap minimal 1 (bukan 0)", async () => {
    prisma.gateway.count.mockResolvedValue(0);
    prisma.gateway.findMany.mockResolvedValue([]);

    const result = await gatewayUseCase.listGatewaysPaginated({
      page: 1,
      rowsPerPage: 10,
    });
    expect(result.totalPages).toBe(1);
  });
});

describe("getGatewayById", () => {
  test("include devices & installedBy di query", async () => {
    prisma.gateway.findUnique.mockResolvedValue({ id: "g1", devices: [] });
    await gatewayUseCase.getGatewayById("g1");
    expect(prisma.gateway.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          devices: true,
          installedBy: expect.any(Object),
        }),
      }),
    );
  });
});

describe("deleteGateway", () => {
  test("panggil prisma.gateway.delete", async () => {
    prisma.gateway.delete.mockResolvedValue({ id: "g1" });
    await gatewayUseCase.deleteGateway("g1");
    expect(prisma.gateway.delete).toHaveBeenCalledWith({ where: { id: "g1" } });
  });
});
