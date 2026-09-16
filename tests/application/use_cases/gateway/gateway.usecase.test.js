jest.mock("../../../../src/frameworks/chirpstack/client", () => ({
  listGateways: jest.fn(),
}));
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
const cs = require("../../../../src/frameworks/chirpstack/client");

beforeEach(() => {
  resetPrismaMock(prisma);
  jest.clearAllMocks();
});

describe("listGatewaysPaginated", () => {
  // Status gateway datang dari ChirpStack, bukan ditebak dari device-nya.
  test("[positive] status & lastSeenAt ngikutin ChirpStack", async () => {
    prisma.gateway.count.mockResolvedValue(2);
    prisma.gateway.findMany.mockResolvedValue([
      { id: "g1", eui: "7276ff0045060ffb", devices: [] },
      { id: "g2", eui: "aaaaaaaaaaaaaaaa", devices: [] },
    ]);
    cs.listGateways.mockResolvedValue({
      data: {
        result: [
          { gatewayId: "7276FF0045060FFB", name: "Kerlink", lastSeenAt: "2026-09-16T08:18:26.260Z", state: 1 },
        ],
      },
    });

    const result = await gatewayUseCase.listGatewaysPaginated();

    expect(result.data[0]).toMatchObject({
      id: "g1",
      status: "online",
      chirpstack: { registered: true, name: "Kerlink" },
    });
    // Nggak ada di ChirpStack -> offline & ditandai belum terdaftar.
    expect(result.data[1]).toMatchObject({
      id: "g2",
      status: "offline",
      chirpstack: { registered: false },
    });
    expect(result.data[0].devices).toBeUndefined();
    expect(result).toMatchObject({ page: 1, rowsPerPage: 10, totalRows: 2, totalPages: 1 });
  });

  test("[negative] middleware mati -> pakai status terakhir dari database", async () => {
    prisma.gateway.count.mockResolvedValue(1);
    prisma.gateway.findMany.mockResolvedValue([
      { id: "g1", eui: "7276ff0045060ffb", status: "online", devices: [] },
    ]);
    cs.listGateways.mockRejectedValue(new Error("ECONNREFUSED"));

    const [row] = (await gatewayUseCase.listGatewaysPaginated()).data;
    expect(row).toMatchObject({ status: "online", chirpstack: null });
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
  test("[positive] detail ikut bawa data ChirpStack", async () => {
    prisma.gateway.findUnique.mockResolvedValue({ id: "g1", eui: "7276ff0045060ffb", devices: [] });
    cs.listGateways.mockResolvedValue({
      data: { result: [{ gatewayId: "7276ff0045060ffb", name: "Kerlink", lastSeenAt: "2026-09-16T08:18:26.260Z", state: 1 }] },
    });

    await expect(gatewayUseCase.getGatewayById("g1")).resolves.toMatchObject({
      id: "g1",
      status: "online",
      chirpstack: { registered: true, name: "Kerlink" },
    });
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

describe("syncGatewaysFromChirpstack", () => {
  const csGateway = (overrides = {}) => ({
    gatewayId: "7276FF0045060FFB",
    name: "Kerlink",
    lastSeenAt: "2026-09-16T08:18:26.260Z",
    state: 1,
    ...overrides,
  });

  test("[positive] status & lastSeenAt diambil dari ChirpStack (EUI beda huruf besar/kecil tetap cocok)", async () => {
    cs.listGateways.mockResolvedValue({ data: { result: [csGateway()] } });
    prisma.gateway.findMany.mockResolvedValue([
      { id: "g1", eui: "7276ff0045060ffb", status: "offline", lastSeenAt: null },
    ]);
    prisma.gateway.update.mockImplementation(async ({ data }) => ({ id: "g1", ...data }));

    const result = await gatewayUseCase.syncGatewaysFromChirpstack();

    expect(prisma.gateway.update).toHaveBeenCalledWith({
      where: { id: "g1" },
      data: { status: "online", lastSeenAt: new Date("2026-09-16T08:18:26.260Z") },
    });
    expect(events.emitGatewayUpdated).toHaveBeenCalled();
    expect(result).toEqual({ checked: 1, updated: 1, created: 0, removed: 0 });
  });

  // Gateway yang ada di ChirpStack tapi belum ada di EMS didaftarkan otomatis.
  test("[positive] gateway baru dari ChirpStack otomatis ditambahkan ke EMS", async () => {
    cs.listGateways.mockResolvedValue({ data: { result: [csGateway()] } });
    prisma.gateway.findMany.mockResolvedValue([]);
    prisma.gateway.create.mockImplementation(async ({ data }) => ({ id: "new", ...data }));

    const result = await gatewayUseCase.syncGatewaysFromChirpstack();

    expect(prisma.gateway.create).toHaveBeenCalledWith({
      data: {
        eui: "7276ff0045060ffb",
        name: "Kerlink",
        description: null,
        status: "online",
        lastSeenAt: new Date("2026-09-16T08:18:26.260Z"),
      },
    });
    expect(events.emitGatewayCreated).toHaveBeenCalled();
    expect(result).toMatchObject({ created: 1 });
  });

  test("[negative] gateway yang sudah ada di EMS nggak dibikin dobel", async () => {
    cs.listGateways.mockResolvedValue({ data: { result: [csGateway()] } });
    prisma.gateway.findMany.mockResolvedValue([
      {
        id: "g1",
        eui: "7276FF0045060FFB",
        status: "online",
        lastSeenAt: new Date("2026-09-16T08:18:26.260Z"),
      },
    ]);

    await gatewayUseCase.syncGatewaysFromChirpstack();
    expect(prisma.gateway.create).not.toHaveBeenCalled();
  });

  test("[positive] state selain ONLINE -> offline", async () => {
    cs.listGateways.mockResolvedValue({ data: { result: [csGateway({ state: 2 })] } });
    prisma.gateway.findMany.mockResolvedValue([
      { id: "g1", eui: "7276ff0045060ffb", status: "online", lastSeenAt: null },
    ]);
    prisma.gateway.update.mockImplementation(async ({ data }) => ({ id: "g1", ...data }));

    await gatewayUseCase.syncGatewaysFromChirpstack();

    expect(prisma.gateway.update.mock.calls[0][0].data.status).toBe("offline");
  });

  test("[negative] nggak ada yang berubah -> nggak nulis ke database", async () => {
    cs.listGateways.mockResolvedValue({ data: { result: [csGateway()] } });
    prisma.gateway.findMany.mockResolvedValue([
      {
        id: "g1",
        eui: "7276ff0045060ffb",
        status: "online",
        lastSeenAt: new Date("2026-09-16T08:18:26.260Z"),
      },
    ]);

    const result = await gatewayUseCase.syncGatewaysFromChirpstack();

    expect(prisma.gateway.update).not.toHaveBeenCalled();
    expect(result.updated).toBe(0);
  });

  // Dihapus di ChirpStack -> ikut dihapus di EMS.
  test("[positive] gateway yang udah nggak ada di ChirpStack & nggak punya device -> dihapus", async () => {
    cs.listGateways.mockResolvedValue({ data: { result: [csGateway()] } });
    prisma.gateway.findMany.mockResolvedValue([
      { id: "g9", eui: "aaaaaaaaaaaaaaaa", name: "Lama", status: "offline", lastSeenAt: null },
    ]);
    prisma.device.count.mockResolvedValue(0);
    prisma.gateway.delete.mockResolvedValue({ id: "g9" });

    const result = await gatewayUseCase.syncGatewaysFromChirpstack();

    expect(prisma.gateway.delete).toHaveBeenCalledWith({ where: { id: "g9" } });
    expect(events.emitGatewayDeleted).toHaveBeenCalledWith("g9");
    expect(result).toMatchObject({ removed: 1 });
  });

  test("[negative] gateway hilang tapi masih punya device -> nggak dihapus, cuma diperingatin", async () => {
    cs.listGateways.mockResolvedValue({ data: { result: [csGateway()] } });
    prisma.gateway.findMany.mockResolvedValue([
      { id: "g9", eui: "aaaaaaaaaaaaaaaa", name: "Lama", status: "offline", lastSeenAt: null },
    ]);
    prisma.device.count.mockResolvedValue(2);

    const result = await gatewayUseCase.syncGatewaysFromChirpstack();

    expect(prisma.gateway.delete).not.toHaveBeenCalled();
    expect(result).toMatchObject({ removed: 0 });
  });

  test("[negative] middleware mati -> nggak ngubah apa-apa & nggak lempar error", async () => {
    cs.listGateways.mockRejectedValue(new Error("ECONNREFUSED"));

    await expect(gatewayUseCase.syncGatewaysFromChirpstack()).resolves.toEqual({ checked: 0, updated: 0, created: 0, removed: 0 });
    expect(prisma.gateway.update).not.toHaveBeenCalled();
    expect(prisma.gateway.create).not.toHaveBeenCalled();
  });
});
