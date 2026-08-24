jest.mock("../../../../src/frameworks/database/prismaClient", () => ({
  prisma: { user: { findUnique: jest.fn() } },
}));
jest.mock("bcrypt", () => ({ compare: jest.fn() }));
jest.mock("jsonwebtoken", () => ({ sign: jest.fn() }));

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const {
  login,
} = require("../../../../src/application/use_cases/authentication/login.usecase");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("login", () => {
  test("[negative] username gak ketemu -> 401, pesan generik (gak bocorin 'user gak ada')", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(login({ username: "ghost", password: "x" })).rejects.toThrow(
      "Username atau password salah",
    );
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  test("[negative] password salah -> 401, pesan SAMA PERSIS kayak username salah (anti user-enumeration)", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      username: "admin",
      passwordHash: "hashed",
      role: { name: "Administrator" },
    });
    bcrypt.compare.mockResolvedValue(false);

    await expect(
      login({ username: "admin", password: "wrong" }),
    ).rejects.toThrow("Username atau password salah");
  });

  test("sukses -> return token & user shape tanpa passwordHash", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      fullName: "Admin",
      username: "admin",
      email: "admin@test.com",
      passwordHash: "hashed",
      roleId: "r1",
      role: { name: "Administrator" },
    });
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("fake-jwt-token");

    const result = await login({ username: "admin", password: "correct" });

    expect(result.token).toBe("fake-jwt-token");
    expect(result.user).toEqual({
      id: "u1",
      fullName: "Admin",
      username: "admin",
      email: "admin@test.com",
      role: "Administrator",
    });
    expect(result.user.passwordHash).toBeUndefined();
  });

  test("payload JWT berisi id, roleId, roleName", async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      fullName: "Admin",
      username: "admin",
      email: "admin@test.com",
      passwordHash: "hashed",
      roleId: "r1",
      role: { name: "Administrator" },
    });
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("fake-jwt-token");

    await login({ username: "admin", password: "correct" });

    expect(jwt.sign).toHaveBeenCalledWith(
      { id: "u1", roleId: "r1", roleName: "Administrator" },
      expect.anything(),
      expect.anything(),
    );
  });
});
