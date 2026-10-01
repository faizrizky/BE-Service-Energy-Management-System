const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { prisma } = require("../../../frameworks/database/prismaClient");
const { config } = require("../../../config/config");
const {
  hashToken,
  generateRawToken,
} = require("../../../frameworks/helpers/tokenHash");
const { logSecurityEvent } = require("../../../frameworks/helpers/securityLog");
const { httpError } = require("../../../frameworks/helpers/httpError");
const { formatDateTime } = require("../../../frameworks/helpers/dateFormat");

/**
 * Bikin JWT access token isinya id, roleId, sama roleName, masa berlakunya
 * ngikutin JWT_EXPIRES_IN.
 *
 * Dipake di:
 * - login (file ini)
 * - refreshToken.usecase.js → refreshAccessToken.
 */
function signAccessToken(user, sessionId) {
  return jwt.sign(
    {
      id: user.id,
      roleId: user.roleId,
      roleName: user.role.name,
      sid: sessionId,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

/**
 * Bikin refresh token acak, nyimpen hash-nya ke tabel RefreshToken (berlaku
 * JWT_REFRESH_EXPIRES_DAYS hari), terus balikin token aslinya.
 *
 * Dipake di:
 * - login (file ini)
 * - refreshToken.usecase.js → refreshAccessToken.
 */
async function issueRefreshToken(userId) {
  const rawToken = generateRawToken();
  const expiresAt = new Date(
    Date.now() + config.jwt.refreshExpiresDays * 24 * 60 * 60 * 1000,
  );

  const { id } = await prisma.refreshToken.create({
    data: { tokenHash: hashToken(rawToken), userId, expiresAt },
    select: { id: true },
  });

  return { token: rawToken, sessionId: id };
}

/**
 * Error 423 akun terkunci, bawa lockedUntil (ISO) biar FE bisa nampilin
 * hitung mundur sendiri.
 *
 * Dipake di: login (file ini).
 */
function lockedError(lockedUntil) {
  const err = httpError(
    `Akun terkunci. Silakan coba lagi setelah ${formatDateTime(lockedUntil)}`,
    423,
  );
  err.lockedUntil = lockedUntil.toISOString();
  return err;
}

/**
 * Proses login pake username atau email: cek akun lagi dikunci apa nggak,
 * cocokin password, ngitung salah password (akun dikunci kalo kebanyakan),
 * nyatet security log, terus ngeluarin token.
 *
 * Dipake di: auth.controller.js → loginController (POST /api/auth/login).
 */
async function login({ username, password }, req) {
  const { maxFailedAttempts, lockoutMinutes } = config.loginSecurity;

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email: username }],
    },
    include: { role: true },
  });

  const genericErr = () => httpError("Username/Email atau password salah", 401);

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

    throw lockedError(user.lockedUntil);
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);

  if (!isValid) {
    const lockExpired = user.lockedUntil && user.lockedUntil <= new Date();

    const { failedLoginCount: nextCount } = await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: lockExpired ? 1 : { increment: 1 },
        lockedUntil: lockExpired ? null : undefined,
      },
      select: { failedLoginCount: true },
    });

    const locked = nextCount >= maxFailedAttempts;
    const lockedUntil = locked
      ? new Date(Date.now() + lockoutMinutes * 60 * 1000)
      : null;
    if (locked) {
      await prisma.user.update({
        where: { id: user.id },
        data: { lockedUntil },
      });
    }

    await logSecurityEvent({
      type: locked ? "LOGIN_LOCKED" : "LOGIN_FAILED",
      username: user.username,
      userId: user.id,
      req,
      detail: locked
        ? `Gagal login ${nextCount} kali. Akun dikunci ${lockoutMinutes} menit`
        : `Password salah. Percobaan ke-${nextCount}`,
    });

    if (locked) throw lockedError(lockedUntil);
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

  const { token: refreshToken, sessionId } = await issueRefreshToken(user.id);
  const accessToken = signAccessToken(user, sessionId);

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
