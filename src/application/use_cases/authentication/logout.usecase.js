const { prisma } = require("../../../frameworks/database/prismaClient");
const { hashToken } = require("../../../frameworks/helpers/tokenHash");

async function logout(rawRefreshToken) {
  const tokenHash = hashToken(rawRefreshToken);

  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

module.exports = { logout };
