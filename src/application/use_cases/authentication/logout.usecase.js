const { prisma } = require("../../../frameworks/database/prismaClient");
const { hashToken } = require("../../../frameworks/helpers/tokenHash");

/**
 * Nyabut refresh token (dicari lewat hash-nya) yang masih aktif. Tetep
 * dianggap sukses walaupun token-nya nggak dikenal.
 *
 * Dipake di: auth.controller.js → logoutController (POST /api/auth/logout).
 */
async function logout(rawRefreshToken) {
  const tokenHash = hashToken(rawRefreshToken);

  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

module.exports = { logout };
