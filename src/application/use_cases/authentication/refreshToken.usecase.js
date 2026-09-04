const { prisma } = require("../../../frameworks/database/prismaClient");
const { hashToken } = require("../../../frameworks/helpers/tokenHash");
const { signAccessToken, issueRefreshToken } = require("./login.usecase");
const { logSecurityEvent } = require("../../../frameworks/helpers/securityLog");

async function refreshAccessToken(rawRefreshToken) {
  const tokenHash = hashToken(rawRefreshToken);

  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { role: true } } },
  });

  const isValid = !record || record.revokedAt || record.expiresAt < new Date();

  if (!isValid) {
    await logSecurityEvent({
      type: "REFRESH_TOKEN_FAILED",
      userId: record?.userId,
      req,
      detail: !record
        ? "Refresh token tidak ditemukan"
        : record.revokedAt
          ? "Refresh token sudah dicabut"
          : "Refresh token sudah kadaluarsa",
    });

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

  await logSecurityEvent({
    type: "REFRESH_TOKEN_SUCCESS",
    userId: record.userId,
    username: record.user.username,
    req,
    detail: "Access token berhasil diperbarui",
  });

  return { accessToken, refreshToken: newRefreshToken };
}

module.exports = { refreshAccessToken };
