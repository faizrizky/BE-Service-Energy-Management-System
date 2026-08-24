jest.mock("../../../../src/frameworks/database/prismaClient", () => ({
  prisma: {
    gateway: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
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
});

describe("getGatewayById", () => {
  test("include devices di query", async () => {
    prisma.gateway.findUnique.mockResolvedValue({ id: "g1", devices: [] });
    await gatewayUseCase.getGatewayById("g1");
    expect(prisma.gateway.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ include: { devices: true } }),
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
