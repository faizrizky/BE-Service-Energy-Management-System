jest.mock("../../../../src/frameworks/database/prismaClient", () => ({
  prisma: {
    role: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    rolePermission: { createMany: jest.fn(), deleteMany: jest.fn() },
    permission: { findMany: jest.fn() },
  },
}));

const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const roleUseCase = require("../../../../src/application/use_cases/role/role.usecase");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createRole", () => {
  test("tanpa permissionIds -> gak manggil assignPermissions sama sekali", async () => {
    prisma.role.create.mockResolvedValue({ id: "role-1" });
    await roleUseCase.createRole({ name: "Test Role" });
    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
  });

  test("dengan permissionIds -> assign lewat createMany dengan skipDuplicates", async () => {
    prisma.role.create.mockResolvedValue({ id: "role-1" });
    prisma.rolePermission.createMany.mockResolvedValue({});

    await roleUseCase.createRole({
      name: "Test Role",
      permissionIds: ["p1", "p2"],
    });

    expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
      data: [
        { roleId: "role-1", permissionId: "p1" },
        { roleId: "role-1", permissionId: "p2" },
      ],
      skipDuplicates: true,
    });
  });

  test("[negative] permissionIds bukan array (misal string) -> gak diassign, gak error", async () => {
    prisma.role.create.mockResolvedValue({ id: "role-1" });
    await roleUseCase.createRole({
      name: "Test Role",
      permissionIds: "not-an-array",
    });
    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
  });
});

describe("updateRole", () => {
  test("dengan permissionIds -> hapus semua rolePermission lama dulu, baru assign ulang", async () => {
    prisma.role.update.mockResolvedValue({ id: "role-1" });
    prisma.rolePermission.deleteMany.mockResolvedValue({});
    prisma.rolePermission.createMany.mockResolvedValue({});

    await roleUseCase.updateRole("role-1", {
      name: "Updated",
      permissionIds: ["p3"],
    });

    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({
      where: { roleId: "role-1" },
    });
    expect(prisma.rolePermission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: [{ roleId: "role-1", permissionId: "p3" }],
      }),
    );
  });

  test("tanpa permissionIds -> permission lama TIDAK dihapus", async () => {
    prisma.role.update.mockResolvedValue({ id: "role-1" });
    await roleUseCase.updateRole("role-1", { name: "Updated" });
    expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
  });
});

describe("listPermissions", () => {
  test("order by module lalu action", async () => {
    prisma.permission.findMany.mockResolvedValue([]);
    await roleUseCase.listPermissions();
    expect(prisma.permission.findMany).toHaveBeenCalledWith({
      orderBy: [{ module: "asc" }, { action: "asc" }],
    });
  });
});
