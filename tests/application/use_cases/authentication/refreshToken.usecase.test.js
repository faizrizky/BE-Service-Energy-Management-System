jest.mock("../../../../src/frameworks/helpers/securityLog", () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
}));

const jwt = require("jsonwebtoken");
const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const { logSecurityEvent } = require("../../../../src/frameworks/helpers/securityLog");
const { hashToken } = require("../../../../src/frameworks/helpers/tokenHash");
const { refreshAccessToken } = require("../../../../src/application/use_cases/authentication/refreshToken.usecase");
const { getMe } = require("../../../../src/application/use_cases/authentication/getMe.usecase");
const { resetPrismaMock } = require("../../../helpers/prisma");

const RAW = "raw-refresh-token-abcdefghij";
const req = { ip: "1.1.1.1", headers: {} };

function record(overrides = {}) {
  return {
    id: "rt1",
    userId: "u1",
    revokedAt: null,
    expiresAt: new Date(Date.now() + 86400000),
    user: { id: "u1", username: "admin", roleId: "r1", role: { name: "Administrator" } },
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock(prisma);
  jest.clearAllMocks();
  prisma.refreshToken.update.mockResolvedValue({});
  prisma.refreshToken.create.mockResolvedValue({});
});

describe("refreshAccessToken", () => {
  test("[positive] token aktif -> token lama dicabut (rotasi) & pasangan token baru dikeluarkan", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(record());

    const result = await refreshAccessToken(RAW, req);

    expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashToken(RAW) },
      include: { user: { include: { role: true } } },
    });
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: "rt1" },
      data: { revokedAt: expect.any(Date) },
    });
    expect(jwt.verify(result.accessToken, process.env.JWT_SECRET)).toMatchObject({ id: "u1", roleName: "Administrator" });
    expect(result.refreshToken).not.toBe(RAW);
    expect(prisma.refreshToken.create).toHaveBeenCalled();
    expect(logSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "REFRESH_TOKEN_SUCCESS" }));
  });

  test.each([
    ["tidak ditemukan", null, "Refresh token tidak ditemukan"],
    ["sudah dicabut (logout)", record({ revokedAt: new Date() }), "Refresh token sudah dicabut"],
    ["kadaluarsa", record({ expiresAt: new Date(Date.now() - 1000) }), "Refresh token sudah kadaluarsa"],
  ])("[negative] token %s -> 401 + log detail, tidak ada token baru", async (_, value, detail) => {
    prisma.refreshToken.findUnique.mockResolvedValue(value);

    await expect(refreshAccessToken(RAW, req)).rejects.toMatchObject({
      status: 401,
      message: "Refresh token tidak valid atau sudah kadaluarsa",
    });
    expect(logSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "REFRESH_TOKEN_FAILED", detail }));
    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  test("[negative] dicabut sekaligus kadaluarsa -> alasan yang dicatat 'dicabut'", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(
      record({ revokedAt: new Date(), expiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(refreshAccessToken(RAW, req)).rejects.toMatchObject({ status: 401 });
    expect(logSecurityEvent.mock.calls[0][0].detail).toBe("Refresh token sudah dicabut");
  });

  test("[negative] gagal mencabut token lama -> token baru TIDAK dikeluarkan", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(record());
    prisma.refreshToken.update.mockRejectedValue(new Error("db down"));
    await expect(refreshAccessToken(RAW, req)).rejects.toThrow("db down");
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  // Rotasi tidak atomik: dua request paralel dengan token yang sama sama-sama lolos
  // karena findUnique -> update tidak dikunci (tidak ada updateMany where revokedAt:null).
  test.failing("[BUG] token yang sama dipakai 2x bersamaan seharusnya hanya berhasil sekali", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(record());
    const results = await Promise.allSettled([refreshAccessToken(RAW, req), refreshAccessToken(RAW, req)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
});

describe("getMe", () => {
  test("[positive] profil tanpa passwordHash, role berupa nama", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      fullName: "Admin",
      username: "admin",
      email: "a@test.com",
      phone: null,
      address: "Jakarta",
      avatarUrl: null,
      passwordHash: "secret",
      role: { id: "r1", name: "Administrator" },
    });

    await expect(getMe("u1")).resolves.toEqual({
      id: "u1",
      fullName: "Admin",
      username: "admin",
      email: "a@test.com",
      phone: null,
      address: "Jakarta",
      avatarUrl: null,
      role: "Administrator",
    });
  });

  test("[negative] user sudah dihapus -> 404", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(getMe("ghost")).rejects.toMatchObject({ status: 404, message: "User tidak ditemukan" });
  });
});
