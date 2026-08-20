const { prisma } = require('../../database/prismaClient');

function checkPermission(module, action) {
  return async (req, res, next) => {
    try {
      const roleId = req.user?.roleId;

      if (!roleId) {
        return res.status(403).json({ message: 'Role tidak ditemukan pada token' });
      }

      const permission = await prisma.rolePermission.findFirst({
        where: {
          roleId,
          permission: { module, action },
        },
      });

      if (!permission) {
        return res.status(403).json({
          message: `Akses ditolak: role kamu tidak punya izin ${module}.${action}`,
        });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = checkPermission;