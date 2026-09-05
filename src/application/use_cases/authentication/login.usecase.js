const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { prisma } = require("../../../frameworks/database/prismaClient");
const { config } = require("../../../config/config");
const {
  hashToken,
  generateRawToken,
} = require("../../../frameworks/helpers/tokenHash");
const { logSecurityEvent } = require("../../../frameworks/helpers/securityLog");

function signAccessToken(user) {
  return jwt.sign(
    { id: user.id, roleId: user.roleId, roleName: user.role.name },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

async function issueRefreshToken(userId) {
  const rawToken = generateRawToken();
  const expiresAt = new Date(
    Date.now() + config.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000,
  );

  await prisma.refreshToken.create({
    data: { tokenHash: hashToken(rawToken), userId, expiresAt },
  });

  return rawToken;
}

async function login({ username, password }, req) {
  const { maxFailedAttempts, lockoutMinutes } = config.loginSecurity;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email: username }],
    },
    include: { role: true },
  });

  const genericErr = () => {
    const err = new Error("Username/Email atau password salah");
    err.status = 401;
    throw err;
  };

  if (!user) {
    await logSecurityEvent({
      type: "LOGIN_FAILED",
      username,
      req,
      detail: "Username/Email tidak ditemukan",
    });
    throw genericErr();
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await logSecurityEvent({
      type: "LOGIN_BLOCKED",
      username: user.username,
      userId: user.id,
      req,
      detail: `Akun terkunci sampai ${user.lockedUntil.toISOString()}`,
    });

    const err = new Error(
      `Akun terkunci. Silakan coba lagi setelah ${user.lockedUntil.toLocaleString()}`,
    );
    err.status = 423;
    throw err;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    const nextCount = user.failedLoginCount + 1;
    const locked = nextCount >= maxFailedAttempts;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: nextCount,
        lockedUntil:
          nextCount >= maxFailedAttempts
            ? new Date(Date.now() + lockoutMinutes * 60 * 1000)
            : undefined,
      },
    });

    await logSecurityEvent({
      type: locked ? "LOGIN_LOCKED" : "LOGIN_FAILED",
      username: user.username,
      userId: user.id,
      req,
      detail: locked
        ? `Gagal login ${nextCount} kali. Akun dikunci ${lockoutMinutes} menit`
        : `Password salah. Percobaan ke-${nextCount}`,
    });

    throw genericErr();
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date(), failedLoginCount: 0, lockedUntil: null },
  });

  await logSecurityEvent({
    type: "LOGIN_SUCCESS",
    username: user.username,
    userId: user.id,
    req,
    detail: "Login berhasil",
  });

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user),
    issueRefreshToken(user.id),
  ]);

  return {
    accessToken,
    refreshToken,
    expiresIn: config.jwt.expiresIn,
    user: {
      id: user.id,
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      role: user.role.name,
    },
  };
}

module.exports = { login, signAccessToken, issueRefreshToken };
