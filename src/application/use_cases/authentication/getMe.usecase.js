const { prisma } = require("../../../frameworks/database/prismaClient");

/**
 * Ngambil profil user dari id plus nama role-nya. Kalo user-nya udah nggak
 * ada, lempar 404.
 *
 * Dipake di: auth.controller.js → meController (GET /api/auth/me).
 */
async function getMe(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          permissions: { include: { permission: true } },
        },
      },
    },
  });

  if (!user) {
    const err = new Error("User tidak ditemukan");
    err.status = 404;
    throw err;
  }

  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    email: user.email,
    phone: user.phone,
    address: user.address,
    avatarUrl: user.avatarUrl,
    role: user.role.name,
    roleId: user.role.id,
    permissions: user.role.permissions.map((rp) => ({
      id: rp.permission.id,
      module: rp.permission.module,
      action: rp.permission.action,
    })),
  };
}

module.exports = { getMe };
