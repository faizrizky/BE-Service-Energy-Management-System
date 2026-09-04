const crypto = require("crypto");

function hashToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function generateRawToken() {
  return crypto.randomBytes(40).toString("hex");
}

module.exports = { hashToken, generateRawToken };
