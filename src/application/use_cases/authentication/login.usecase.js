const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { prisma } = require("../../../frameworks/database/prismaClient");
const { config } = require("../../../config/config");
const {
  hashToken,
  generateRawToken,
} = require("../../../frameworks/helpers/tokenHash");

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

async function login({ username, password }) {
  const user = await prisma.user.findUnique({
    where: { username },
    include: { role: true },
  });

  if (!user) {
    const err = new Error("Username atau password salah");
    err.status = 401;
    throw err;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    const err = new Error("Username atau password salah");
    err.status = 401;
    throw err;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastActiveAt: new Date() },
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
