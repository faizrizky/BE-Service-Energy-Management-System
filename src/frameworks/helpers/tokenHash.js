const crypto = require("crypto");

/**
 * Hash SHA-256 dari refresh token. Yang disimpen di database cuma hash-nya.
 *
 * Dipake di:
 * - login.usecase.js → issueRefreshToken
 * - logout.usecase.js → logout
 * - refreshToken.usecase.js → refreshAccessToken.
 */
function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Bikin refresh token acak 40 byte (80 karakter hex).
 *
 * Dipake di: login.usecase.js → issueRefreshToken.
 */
function generateRawToken() {
  return crypto.randomBytes(40).toString("hex");
}

module.exports = { hashToken, generateRawToken };
