jest.mock("../../../../src/frameworks/helpers/sessionRevocation", () => ({
  revokeSession: jest.fn().mockResolvedValue(undefined),
}));

const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const { hashToken } = require("../../../../src/frameworks/helpers/tokenHash");
const { revokeSession } = require("../../../../src/frameworks/helpers/sessionRevocation");
const { logout, revokeAllSessions } = require("../../../../src/application/use_cases/authentication/logout.usecase");
const { resetPrismaMock } = require("../../../helpers/prisma");

beforeEach(() => {
  resetPrismaMock(prisma);
  jest.clearAllMocks();
  prisma.refreshToken.update.mockResolvedValue({});
});

describe("logout", () => {
  test("[positive] refresh token aktif dicabut (dicari lewat hash, bukan token mentah) & sesinya masuk daftar cabut", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({ id: "rt1", revokedAt: null });
    await logout("raw-refresh-token-1234567890");

    const find = prisma.refreshToken.findUnique.mock.calls[0][0];
    expect(find.where).toEqual({ tokenHash: hashToken("raw-refresh-token-1234567890") });
    expect(JSON.stringify(find)).not.toContain("raw-refresh-token-1234567890");

    const update = prisma.refreshToken.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: "rt1" });
    expect(update.data.revokedAt).toBeInstanceOf(Date);
    expect(revokeSession).toHaveBeenCalledWith("rt1");
  });

  test("[positive] refresh token udah dicabut (misal habis rotasi) -> nggak di-update lagi, tapi sesinya tetep dicabut", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({ id: "rt1", revokedAt: new Date() });
    await logout("raw-refresh-token-1234567890");
    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    expect(revokeSession).toHaveBeenCalledWith("rt1");
  });

  test("[negative] token tidak dikenal -> tetap sukses (idempotent, tidak bocor info), Redis nggak disentuh", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(logout("unknown-token-000000000000")).resolves.toBeUndefined();
    expect(revokeSession).not.toHaveBeenCalled();
  });

  test("[negative] DB error diteruskan ke pemanggil", async () => {
    prisma.refreshToken.findUnique.mockRejectedValue(new Error("db down"));
    await expect(logout("token-xxxxxxxxxxxxxxxxxxxx")).rejects.toThrow("db down");
  });

  test("[negative] Redis error diteruskan (logout gagal keliatan, bukan diem-diem sukses)", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({ id: "rt1", revokedAt: null });
    revokeSession.mockRejectedValueOnce(new Error("redis down"));
    await expect(logout("token-xxxxxxxxxxxxxxxxxxxx")).rejects.toThrow("redis down");
  });
});

describe("revokeAllSessions", () => {
  beforeEach(() => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });
  });

  test("[positive] semua refresh token aktif dicabut & semua sesi yang belum kadaluarsa masuk daftar cabut", async () => {
    prisma.refreshToken.findMany.mockResolvedValue([{ id: "rt1" }, { id: "rt2" }, { id: "rt-lama-dirotasi" }]);

    await revokeAllSessions("u1");

    const find = prisma.refreshToken.findMany.mock.calls[0][0];
    expect(find.where.userId).toBe("u1");
    expect(find.where.expiresAt.gt).toBeInstanceOf(Date);
    const update = prisma.refreshToken.updateMany.mock.calls[0][0];
    expect(update.where).toEqual({ userId: "u1", revokedAt: null });
    expect(update.data.revokedAt).toBeInstanceOf(Date);
    expect(revokeSession.mock.calls).toEqual([["rt1"], ["rt2"], ["rt-lama-dirotasi"]]);
  });

  test("[negative] user belum punya sesi -> nggak ada yang dicabut di Redis, nggak error", async () => {
    prisma.refreshToken.findMany.mockResolvedValue([]);
    await expect(revokeAllSessions("u1")).resolves.toBeUndefined();
    expect(revokeSession).not.toHaveBeenCalled();
  });

  test("[negative] Redis error diteruskan (kunci akun nggak diam-diam gagal nendang sesi)", async () => {
    prisma.refreshToken.findMany.mockResolvedValue([{ id: "rt1" }]);
    revokeSession.mockRejectedValueOnce(new Error("redis down"));
    await expect(revokeAllSessions("u1")).rejects.toThrow("redis down");
  });
});
