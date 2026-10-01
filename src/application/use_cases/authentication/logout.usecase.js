const { prisma } = require("../../../frameworks/database/prismaClient");
const { hashToken } = require("../../../frameworks/helpers/tokenHash");
const {
  revokeSession,
} = require("../../../frameworks/helpers/sessionRevocation");

/**
 * Nyabut refresh token (dicari lewat hash-nya) dan masukin sesinya ke daftar
 * cabut, jadi access token pasangannya langsung ditolak walau belum
 * kadaluarsa. Tetep dianggap sukses walaupun token-nya nggak dikenal.
 *
 * Dipake di: auth.controller.js → logoutController (POST /api/auth/logout).
 */
async function logout(rawRefreshToken) {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(rawRefreshToken) },
    select: { id: true, revokedAt: true },
  });

  if (!record) return;

  if (!record.revokedAt) {
    await prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
  }

  await revokeSession(record.id);
}

module.exports = { logout };
