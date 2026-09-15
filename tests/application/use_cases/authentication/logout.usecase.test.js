const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const { hashToken } = require("../../../../src/frameworks/helpers/tokenHash");
const { logout } = require("../../../../src/application/use_cases/authentication/logout.usecase");
const { resetPrismaMock } = require("../../../helpers/prisma");

beforeEach(() => resetPrismaMock(prisma));

describe("logout", () => {
  test("[positive] refresh token aktif dicabut berdasarkan hash (bukan token mentah)", async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    await logout("raw-refresh-token-1234567890");

    const call = prisma.refreshToken.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ tokenHash: hashToken("raw-refresh-token-1234567890"), revokedAt: null });
    expect(call.data.revokedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(call)).not.toContain("raw-refresh-token-1234567890");
  });

  test("[negative] token tidak dikenal / sudah dicabut -> tetap sukses (idempotent, tidak bocor info)", async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(logout("unknown-token-000000000000")).resolves.toBeUndefined();
  });

  test("[negative] DB error diteruskan ke pemanggil", async () => {
    prisma.refreshToken.updateMany.mockRejectedValue(new Error("db down"));
    await expect(logout("token-xxxxxxxxxxxxxxxxxxxx")).rejects.toThrow("db down");
  });
});
