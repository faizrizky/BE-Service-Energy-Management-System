const { prisma } = require("../../../frameworks/database/prismaClient");

/**
 * List role pake paginasi (urut nama) dan search nama, plus permission &
 * jumlah user-nya.
 *
 * Dipake di: role.controller.js → index (GET /api/roles).
 */
async function listRolesPaginated({ page = 1, rowsPerPage = 10, search } = {}) {
  const where = search
    ? {
        OR: [{ name: { contains: search, mode: "insensitive" } }],
      }
    : undefined;

  const [totalRows, roles] = await Promise.all([
    prisma.role.count({ where }),
    prisma.role.findMany({
      where,
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
      orderBy: { name: "asc" },
      skip: (page - 1) * rowsPerPage,
      take: rowsPerPage,
    }),
  ]);
  return {
    data: roles,
    page,
    rowsPerPage,
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / rowsPerPage)),
  };
}

/**
 * List semua role tanpa paginasi plus permission & jumlah user-nya.
 *
 * Dipake di: Belom dipake di mana-mana.
 */
async function listRoles() {
  return prisma.role.findMany({
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  });
}

/**
 * Detail role plus permission-nya. Balikin null kalo nggak ketemu.
 *
 * Dipake di: role.controller.js → show (GET /api/roles/:id).
 */
async function getRoleById(id) {
  return prisma.role.findUnique({
    where: { id },
    include: { permissions: { include: { permission: true } } },
  });
}

/**
 * Bikin role terus pasang permission-nya kalo permissionIds berupa array.
 *
 * Dipake di: role.controller.js → store (POST /api/roles).
 */
async function createRole(data) {
  const role = await prisma.role.create({
    data: { name: data.name, description: data.description },
  });

  if (Array.isArray(data.permissionIds)) {
    await assignPermissions(role.id, data.permissionIds);
  }

  return role;
}

/**
 * Ngedit nama/deskripsi role. Kalo permissionIds dikirim, permission lama
 * dihapus semua terus diganti yang baru.
 *
 * Dipake di: role.controller.js → update (PUT /api/roles/:id).
 */
async function updateRole(id, data) {
  const role = await prisma.role.update({
    where: { id },
    data: { name: data.name, description: data.description },
  });

  if (Array.isArray(data.permissionIds)) {
    await prisma.rolePermission.deleteMany({ where: { roleId: id } });
    await assignPermissions(id, data.permissionIds);
  }

  return role;
}

/**
 * Hapus role berdasarkan id.
 *
 * Dipake di: role.controller.js → destroy (DELETE /api/roles/:id).
 */
async function deleteRole(id) {
  return prisma.role.delete({ where: { id } });
}

/**
 * Nyimpen relasi role–permission sekaligus banyak, yang dobel di-skip.
 *
 * Dipake di: createRole, updateRole (file ini).
 */
async function assignPermissions(roleId, permissionIds) {
  await prisma.rolePermission.createMany({
    data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
    skipDuplicates: true,
  });
}

/**
 * Daftar semua permission, diurutin per module terus action.
 *
 * Dipake di: role.controller.js → permissionsList (GET
 *   /api/roles/permissions).
 */
async function listPermissions() {
  return prisma.permission.findMany({
    orderBy: [{ module: "asc" }, { action: "asc" }],
  });
}

module.exports = {
  listRolesPaginated,
  listRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  listPermissions,
};
