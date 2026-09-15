jest.mock("bcrypt", () => ({ compare: jest.fn(), hash: jest.fn() }));
jest.mock("../../../../src/frameworks/helpers/securityLog", () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
}));

const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const { logSecurityEvent } = require("../../../../src/frameworks/helpers/securityLog");
const { hashToken } = require("../../../../src/frameworks/helpers/tokenHash");
const {
  login,
  signAccessToken,
  issueRefreshToken,
} = require("../../../../src/application/use_cases/authentication/login.usecase");
const { resetPrismaMock } = require("../../../helpers/prisma");

const req = { ip: "1.1.1.1", headers: {} };

function user(overrides = {}) {
  return {
    id: "u1",
    fullName: "Admin",
    username: "admin",
    email: "admin@test.com",
    passwordHash: "hashed",
    roleId: "r1",
    role: { name: "Administrator" },
    failedLoginCount: 0,
    lockedUntil: null,
    ...overrides,
  };
}

beforeEach(() => {
  resetPrismaMock(prisma);
  jest.clearAllMocks();
  prisma.user.update.mockResolvedValue({});
  prisma.refreshToken.create.mockResolvedValue({});
});

describe("login", () => {
  test("[positive] kredensial benar -> access token valid, refresh token, user tanpa passwordHash", async () => {
    prisma.user.findFirst.mockResolvedValue(user({ failedLoginCount: 3 }));
    bcrypt.compare.mockResolvedValue(true);

    const result = await login({ username: "admin", password: "correct" }, req);

    const payload = jwt.verify(result.accessToken, process.env.JWT_SECRET);
    expect(payload).toMatchObject({ id: "u1", roleId: "r1", roleName: "Administrator" });
    expect(result.refreshToken).toMatch(/^[0-9a-f]{80}$/);
    expect(result.expiresIn).toBe("1h");
    expect(result.user).toEqual({
      id: "u1",
      fullName: "Admin",
      username: "admin",
      email: "admin@test.com",
      role: "Administrator",
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { lastActiveAt: expect.any(Date), failedLoginCount: 0, lockedUntil: null },
    });
    expect(logSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "LOGIN_SUCCESS", userId: "u1" }));
  });

  test("[positive] bisa login dengan email (query OR username/email)", async () => {
    prisma.user.findFirst.mockResolvedValue(user());
    bcrypt.compare.mockResolvedValue(true);
    await login({ username: "admin@test.com", password: "x" }, req);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ username: "admin@test.com" }, { email: "admin@test.com" }] },
      include: { role: true },
    });
  });

  test("[positive] refresh token disimpan sebagai hash dengan masa berlaku 7 hari", async () => {
    prisma.user.findFirst.mockResolvedValue(user());
    bcrypt.compare.mockResolvedValue(true);
    const before = Date.now();
    const { refreshToken } = await login({ username: "admin", password: "x" }, req);

    const { data } = prisma.refreshToken.create.mock.calls[0][0];
    expect(data.tokenHash).toBe(hashToken(refreshToken));
    expect(data.userId).toBe("u1");
    const days = (data.expiresAt.getTime() - before) / 86400000;
    expect(days).toBeGreaterThan(6.99);
    expect(days).toBeLessThan(7.01);
  });

  test("[positive] lockedUntil sudah lewat -> boleh login lagi", async () => {
    prisma.user.findFirst.mockResolvedValue(user({ lockedUntil: new Date(Date.now() - 1000) }));
    bcrypt.compare.mockResolvedValue(true);
    await expect(login({ username: "admin", password: "x" }, req)).resolves.toHaveProperty("accessToken");
  });

  test("[negative] username/email tidak ada -> 401 pesan generik + log", async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(login({ username: "ghost", password: "x" }, req)).rejects.toMatchObject({
      status: 401,
      message: "Username/Email atau password salah",
    });
    expect(logSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "LOGIN_FAILED", username: "ghost" }));
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  test("[negative] password salah -> 401 pesan SAMA dengan user tidak ada (anti enumerasi) & counter naik", async () => {
    prisma.user.findFirst.mockResolvedValue(user({ failedLoginCount: 1 }));
    bcrypt.compare.mockResolvedValue(false);

    await expect(login({ username: "admin", password: "wrong" }, req)).rejects.toMatchObject({
      status: 401,
      message: "Username/Email atau password salah",
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { failedLoginCount: 2, lockedUntil: undefined },
    });
    expect(logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LOGIN_FAILED", detail: "Password salah. Percobaan ke-2" }),
    );
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  test("[negative] gagal ke-5 -> akun dikunci 15 menit & log LOGIN_LOCKED", async () => {
    prisma.user.findFirst.mockResolvedValue(user({ failedLoginCount: 4 }));
    bcrypt.compare.mockResolvedValue(false);
    const before = Date.now();

    await expect(login({ username: "admin", password: "wrong" }, req)).rejects.toMatchObject({ status: 401 });

    const { data } = prisma.user.update.mock.calls[0][0];
    expect(data.failedLoginCount).toBe(5);
    const minutes = (data.lockedUntil.getTime() - before) / 60000;
    expect(minutes).toBeGreaterThan(14.9);
    expect(minutes).toBeLessThan(15.1);
    expect(logSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "LOGIN_LOCKED" }));
  });

  test("[negative] akun masih terkunci -> 423 tanpa cek password (walau password benar)", async () => {
    prisma.user.findFirst.mockResolvedValue(user({ lockedUntil: new Date(Date.now() + 60000) }));
    bcrypt.compare.mockResolvedValue(true);

    await expect(login({ username: "admin", password: "correct" }, req)).rejects.toMatchObject({
      status: 423,
      message: expect.stringContaining("Akun terkunci"),
    });
    expect(bcrypt.compare).not.toHaveBeenCalled();
    expect(logSecurityEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "LOGIN_BLOCKED" }));
  });

  test("[negative] error DB saat mencari user diteruskan", async () => {
    prisma.user.findFirst.mockRejectedValue(new Error("db down"));
    await expect(login({ username: "admin", password: "x" }, req)).rejects.toThrow("db down");
  });
});

describe("signAccessToken & issueRefreshToken", () => {
  test("[positive] access token berisi id, roleId, roleName & exp", () => {
    const token = signAccessToken(user());
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    expect(payload).toMatchObject({ id: "u1", roleId: "r1", roleName: "Administrator" });
    expect(payload.exp - payload.iat).toBe(3600);
  });

  test("[negative] user tanpa relasi role -> melempar (bukan token tanpa roleName)", () => {
    expect(() => signAccessToken({ id: "u1", roleId: "r1" })).toThrow(TypeError);
  });

  test("[positive] issueRefreshToken selalu unik", async () => {
    const a = await issueRefreshToken("u1");
    const b = await issueRefreshToken("u1");
    expect(a).not.toBe(b);
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(2);
  });
});
