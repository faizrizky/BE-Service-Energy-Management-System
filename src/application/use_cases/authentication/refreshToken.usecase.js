const { prisma } = require("../../../frameworks/database/prismaClient");
const { hashToken } = require("../../../frameworks/helpers/tokenHash");
const { signAccessToken, issueRefreshToken } = require("./login.usecase");

async function refreshAccessToken(rawRefreshToken) {
  const tokenHash = hashToken(rawRefreshToken);

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { role: true } } },
  });

  const isValid = !record || record.revokedAt || record.expiresAt < new Date();

  if (isValid) {
    const err = new Error("Refresh token tidak valid atau sudah kadaluarsa");
    err.status = 401;
    throw err;
  }

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { revokedAt: new Date() },
  });

  const [accessToken, newRefreshToken] = await Promise.all([
    signAccessToken(record.user),
    issueRefreshToken(record.userId),
  ]);

  return { accessToken, refreshToken: newRefreshToken };
}

module.exports = { refreshAccessToken };
