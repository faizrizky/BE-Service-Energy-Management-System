jest.mock("../../../../src/frameworks/helpers/securityLog", () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
}));

const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const { logSecurityEvent } = require("../../../../src/frameworks/helpers/securityLog");
const checkPermission = require("../../../../src/frameworks/webserver/middlewares/rbacMiddleware");
const { mockReq, mockRes, mockNext } = require("../../../helpers/http");
const { resetPrismaMock } = require("../../../helpers/prisma");

beforeEach(() => {
  resetPrismaMock(prisma);
  logSecurityEvent.mockClear();
});

async function run(user, module = "device", action = "power_control") {
  const req = mockReq({ user });
  const res = mockRes();
  const next = mockNext();
  await checkPermission(module, action)(req, res, next);
  return { req, res, next };
}

describe("checkPermission", () => {
  test("[positive] role punya permission -> next() tanpa log", async () => {
    prisma.rolePermission.findFirst.mockResolvedValue({ roleId: "r1" });
    const { res, next } = await run({ id: "u1", roleId: "r1" });

    expect(prisma.rolePermission.findFirst).toHaveBeenCalledWith({
      where: { roleId: "r1", permission: { module: "device", action: "power_control" } },
    });
    expect(next).toHaveBeenCalledWith();
    expect(res.status).not.toHaveBeenCalled();
    expect(logSecurityEvent).not.toHaveBeenCalled();
  });

  test("[negative] role tidak punya permission -> 403 + security log", async () => {
    prisma.rolePermission.findFirst.mockResolvedValue(null);
    const { res, next } = await run({ id: "u1", roleId: "r1" }, "user", "delete");

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Akses ditolak: role kamu tidak punya izin user.delete",
    });
    expect(logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PERMISSION_DENIED",
        userId: "u1",
        detail: "Akses ditolak untuk user.delete",
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("[negative] token tanpa roleId -> 403 tanpa query DB", async () => {
    const { res, next } = await run({ id: "u1" });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Role tidak ditemukan pada token" });
    expect(prisma.rolePermission.findFirst).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  test("[negative] req.user tidak ada sama sekali -> 403, tidak crash", async () => {
    const { res } = await run(undefined);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: undefined }),
    );
  });

  test("[negative] DB error -> diteruskan ke error handler lewat next(err)", async () => {
    const err = new Error("db down");
    prisma.rolePermission.findFirst.mockRejectedValue(err);
    const { res, next } = await run({ id: "u1", roleId: "r1" });
    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
  });
});
