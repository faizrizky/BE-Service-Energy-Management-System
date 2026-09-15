const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const roleUseCase = require("../../../../src/application/use_cases/role/role.usecase");
const { resetPrismaMock } = require("../../../helpers/prisma");

beforeEach(() => resetPrismaMock(prisma));

describe("listRolesPaginated", () => {
  test("[positive] default paginasi, include permission & jumlah user, urut nama", async () => {
    prisma.role.count.mockResolvedValue(12);
    prisma.role.findMany.mockResolvedValue([{ id: "r1" }]);

    const result = await roleUseCase.listRolesPaginated();

    expect(result).toEqual({ data: [{ id: "r1" }], page: 1, rowsPerPage: 10, totalRows: 12, totalPages: 2 });
    expect(prisma.role.findMany).toHaveBeenCalledWith({
      where: undefined,
      include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } },
      orderBy: { name: "asc" },
      skip: 0,
      take: 10,
    });
  });

  test("[positive] search nama case-insensitive & halaman berikutnya", async () => {
    prisma.role.count.mockResolvedValue(0);
    prisma.role.findMany.mockResolvedValue([]);
    await roleUseCase.listRolesPaginated({ search: "admin", page: 2, rowsPerPage: 5 });
    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ name: { contains: "admin", mode: "insensitive" } }] },
        skip: 5,
        take: 5,
      }),
    );
  });

  test("[negative] tidak ada data -> totalPages 1", async () => {
    prisma.role.count.mockResolvedValue(0);
    prisma.role.findMany.mockResolvedValue([]);
    expect((await roleUseCase.listRolesPaginated()).totalPages).toBe(1);
  });
});

describe("listRoles & getRoleById & listPermissions", () => {
  test("[positive] listRoles tanpa filter", async () => {
    prisma.role.findMany.mockResolvedValue([]);
    await roleUseCase.listRoles();
    expect(prisma.role.findMany).toHaveBeenCalledWith(expect.objectContaining({ include: expect.any(Object) }));
  });

  test("[positive/negative] getRoleById ditemukan & tidak (null)", async () => {
    prisma.role.findUnique.mockResolvedValueOnce({ id: "r1" }).mockResolvedValueOnce(null);
    await expect(roleUseCase.getRoleById("r1")).resolves.toEqual({ id: "r1" });
    await expect(roleUseCase.getRoleById("x")).resolves.toBeNull();
  });

  test("[positive] listPermissions urut module lalu action", async () => {
    prisma.permission.findMany.mockResolvedValue([]);
    await roleUseCase.listPermissions();
    expect(prisma.permission.findMany).toHaveBeenCalledWith({ orderBy: [{ module: "asc" }, { action: "asc" }] });
  });
});

describe("createRole", () => {
  test("[positive] dengan permissionIds -> createMany skipDuplicates", async () => {
    prisma.role.create.mockResolvedValue({ id: "r1" });
    prisma.rolePermission.createMany.mockResolvedValue({ count: 2 });

    await roleUseCase.createRole({ name: "Operator", description: "d", permissionIds: ["p1", "p2"] });

    expect(prisma.role.create).toHaveBeenCalledWith({ data: { name: "Operator", description: "d" } });
    expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
      data: [
        { roleId: "r1", permissionId: "p1" },
        { roleId: "r1", permissionId: "p2" },
      ],
      skipDuplicates: true,
    });
  });

  test("[positive] tanpa permissionIds -> tidak assign permission", async () => {
    prisma.role.create.mockResolvedValue({ id: "r1" });
    await roleUseCase.createRole({ name: "Viewer" });
    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
  });

  test("[negative] permissionIds bukan array -> diabaikan", async () => {
    prisma.role.create.mockResolvedValue({ id: "r1" });
    await roleUseCase.createRole({ name: "Viewer", permissionIds: "p1" });
    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
  });

  test("[negative] nama duplikat (P2002) diteruskan & permission tidak di-assign", async () => {
    prisma.role.create.mockRejectedValue(Object.assign(new Error("Unique"), { code: "P2002" }));
    await expect(roleUseCase.createRole({ name: "Admin", permissionIds: ["p1"] })).rejects.toMatchObject({ code: "P2002" });
    expect(prisma.rolePermission.createMany).not.toHaveBeenCalled();
  });

  // Role dibuat dulu lalu permission di-assign tanpa transaksi.
  test.failing("[BUG] assign permission gagal seharusnya membatalkan role yang sudah dibuat (transaksi)", async () => {
    prisma.role.create.mockResolvedValue({ id: "r1" });
    prisma.rolePermission.createMany.mockRejectedValue(new Error("FK permission"));
    await expect(roleUseCase.createRole({ name: "X", permissionIds: ["bad"] })).rejects.toThrow();
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

describe("updateRole", () => {
  test("[positive] permissionIds dikirim -> permission lama dihapus lalu diganti", async () => {
    prisma.role.update.mockResolvedValue({ id: "r1" });
    await roleUseCase.updateRole("r1", { name: "Op", permissionIds: ["p3"] });

    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: "r1" } });
    expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
      data: [{ roleId: "r1", permissionId: "p3" }],
      skipDuplicates: true,
    });
    expect(prisma.rolePermission.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.rolePermission.createMany.mock.invocationCallOrder[0],
    );
  });

  test("[positive] permissionIds array kosong -> semua permission dicabut", async () => {
    prisma.role.update.mockResolvedValue({ id: "r1" });
    await roleUseCase.updateRole("r1", { permissionIds: [] });
    expect(prisma.rolePermission.deleteMany).toHaveBeenCalled();
    expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({ data: [], skipDuplicates: true });
  });

  test("[negative] tanpa permissionIds -> permission lama tidak disentuh", async () => {
    prisma.role.update.mockResolvedValue({ id: "r1" });
    await roleUseCase.updateRole("r1", { name: "Op" });
    expect(prisma.rolePermission.deleteMany).not.toHaveBeenCalled();
  });

  test("[negative] role tidak ada (P2025) diteruskan", async () => {
    prisma.role.update.mockRejectedValue(Object.assign(new Error("not found"), { code: "P2025" }));
    await expect(roleUseCase.updateRole("x", { name: "a" })).rejects.toMatchObject({ code: "P2025" });
  });
});

describe("deleteRole", () => {
  test("[positive] hapus berdasarkan id", async () => {
    prisma.role.delete.mockResolvedValue({ id: "r1" });
    await roleUseCase.deleteRole("r1");
    expect(prisma.role.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
  });

  test("[negative] role masih dipakai user (P2003) diteruskan", async () => {
    prisma.role.delete.mockRejectedValue(Object.assign(new Error("FK"), { code: "P2003" }));
    await expect(roleUseCase.deleteRole("r1")).rejects.toMatchObject({ code: "P2003" });
  });
});
