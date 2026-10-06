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

/**
 * Cabut semua sesi login satu user: refresh token yang masih aktif dicabut,
 * dan semua sesi yang belum kadaluarsa (termasuk yang udah dirotasi, karena
 * access token-nya bisa masih hidup) masuk daftar cabut di Redis.
 *
 * Dipake di: login.usecase.js → login (pas akun baru kekunci).
 */
async function revokeAllSessions(userId) {
  const now = new Date();
  const tokens = await prisma.refreshToken.findMany({
    where: { userId, expiresAt: { gt: now } },
    select: { id: true },
  });

  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });

  await Promise.all(tokens.map((t) => revokeSession(t.id)));
}
module.exports = { logout, revokeAllSessions };
