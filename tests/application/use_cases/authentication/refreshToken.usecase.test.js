jest.mock("../../../../src/frameworks/database/prismaClient", () => ({
  prisma: {
    refreshToken: { findUnique: jest.fn(), update: jest.fn() },
  },
}));
jest.mock("../../../../src/frameworks/helpers/securityLog", () => ({
  logSecurityEvent: jest.fn(),
}));
jest.mock(
  "../../../../src/application/use_cases/authentication/login.usecase",
  () => ({
    signAccessToken: jest.fn(() => "new-access-token"),
    issueRefreshToken: jest.fn(() => "new-refresh-token"),
  }),
);

const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const {
  refreshAccessToken,
} = require("../../../../src/application/use_cases/authentication/refreshToken.usecase");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("refreshAccessToken", () => {
  test("token valid & aktif -> BERHASIL mengeluarkan access+refresh token baru", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt-1",
      userId: "u1",
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "u1", username: "admin", role: { name: "Administrator" } },
    });
    prisma.refreshToken.update.mockResolvedValue({});

    const result = await refreshAccessToken("raw-token", {});

    expect(result.accessToken).toBe("new-access-token");
    expect(result.refreshToken).toBe("new-refresh-token");
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: "rt-1" },
      data: { revokedAt: expect.any(Date) },
    });
  });

  test("[negative] token gak ketemu -> 401, TIDAK crash", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);

    await expect(refreshAccessToken("garbage-token", {})).rejects.toThrow(
      "Refresh token tidak valid atau sudah kadaluarsa",
    );
    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
  });

  test("[negative] token sudah di-revoke (habis logout) -> HARUS ditolak, tidak boleh lolos", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt-2",
      userId: "u1",
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: "u1", username: "admin", role: { name: "Administrator" } },
    });

    await expect(refreshAccessToken("revoked-token", {})).rejects.toThrow(
      "Refresh token tidak valid atau sudah kadaluarsa",
    );
    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
  });

  test("[negative] token sudah expired -> HARUS ditolak, tidak boleh lolos", async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: "rt-3",
      userId: "u1",
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      user: { id: "u1", username: "admin", role: { name: "Administrator" } },
    });

    await expect(refreshAccessToken("expired-token", {})).rejects.toThrow(
      "Refresh token tidak valid atau sudah kadaluarsa",
    );
    expect(prisma.refreshToken.update).not.toHaveBeenCalled();
  });
});
