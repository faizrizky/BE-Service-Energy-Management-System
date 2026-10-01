const { prisma } = require("../../database/prismaClient");
const { logSecurityEvent } = require("../../helpers/securityLog");

/**
 * Bikin middleware yang ngecek role user (roleId di token) punya permission
 * module.action di database. Kalo nggak punya, bales 403 & nyatet security
 * log.
 *
 * Dipake di: Semua route dashboard, device, gateway, report, role, room,
 *   schedule, sama user (kecuali PUT /api/users/me).
 */
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

      if (!(await roleHasPermission(roleId, module, action))) {
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

/**
 * true kalo role punya permission module.action di database.
 *
 * Dipake di:
 * - checkPermission (file ini)
 * - socket.js → connection (gabung room notifikasi).
 */
async function roleHasPermission(roleId, module, action) {
  if (!roleId) return false;
  const permission = await prisma.rolePermission.findFirst({
    where: { roleId, permission: { module, action } },
  });
  return Boolean(permission);
}

module.exports = checkPermission;
module.exports.roleHasPermission = roleHasPermission;
