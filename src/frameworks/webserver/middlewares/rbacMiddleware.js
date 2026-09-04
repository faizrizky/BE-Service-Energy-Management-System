const { prisma } = require("../../database/prismaClient");
const { logSecurityEvent } = require("../../helpers/securityLog");

function checkPermission(module, action) {
  return async (req, res, next) => {
    try {
      const roleId = req.user?.roleId;

      if (!roleId) {
        await logSecurityEvent({
          type: "PERMISSION_DENIED",
          userId: req.user?.id,
          req,
          detail: `Role tidak ditemukan saat mengakses ${module}.${action}`,
        });

        return res
          .status(403)
          .json({ message: "Role tidak ditemukan pada token" });
      }

      const permission = await prisma.rolePermission.findFirst({
        where: {
          roleId,
          permission: { module, action },
        },
      });

      if (!permission) {
        await logSecurityEvent({
          type: "PERMISSION_DENIED",
          userId: req.user?.id,
          req,
          detail: `Akses ditolak untuk ${module}.${action}`,
        });

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
