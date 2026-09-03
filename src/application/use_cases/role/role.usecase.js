const { prisma } = require("../../../frameworks/database/prismaClient");

async function listRolesPaginated(filter = {}) {
  const { page = 1, rowsPerPage = 10, search } = filter;

  const [totalRows, roles] = await Promise.all([
    prisma.role.count(),
    prisma.role.findMany({
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

async function listRoles() {
  return prisma.role.findMany({
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  });
}

async function getRoleById(id) {
  return prisma.role.findUnique({
    where: { id },
    include: { permissions: { include: { permission: true } } },
  });
}

async function createRole(data) {
  const role = await prisma.role.create({
    data: { name: data.name, description: data.description },
  });

  if (Array.isArray(data.permissionIds)) {
    await assignPermissions(role.id, data.permissionIds);
  }

  return role;
}

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

async function deleteRole(id) {
  return prisma.role.delete({ where: { id } });
}

async function assignPermissions(roleId, permissionIds) {
  await prisma.rolePermission.createMany({
    data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
    skipDuplicates: true,
  });
}

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
