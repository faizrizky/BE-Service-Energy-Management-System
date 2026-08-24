jest.mock("../../../../src/frameworks/database/prismaClient", () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));

const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const {
  getMe,
} = require("../../../../src/application/use_cases/authentication/getMe.usecase");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("getMe", () => {
  test("[negative] 404 kalau user gak ketemu", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(getMe("id-gak-ada")).rejects.toThrow("User tidak ditemukan");
  });

  test("return shape tanpa passwordHash, role jadi string (bukan object)", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      fullName: "Admin",
      username: "admin",
      email: "admin@test.com",
      phone: "0812",
      address: "Jakarta",
      avatarUrl: null,
      passwordHash: "should-not-appear",
      roleId: "r1",
      role: { name: "Administrator" },
    });

    const result = await getMe("u1");

    expect(result.role).toBe("Administrator");
    expect(result.passwordHash).toBeUndefined();
  });
});
