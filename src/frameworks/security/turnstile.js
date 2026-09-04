const { config } = require("../../config/config");
const logger = require("../helpers/logger");

async function verifyTurnstile(token, remoteIp) {
  if (!token) return false;
  try {
    const res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          secret: config.turnstile.secretKey,
          response: token,
          remoteip: remoteIp || "",
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    const data = await res.json();
    return data.success === true;
  } catch (err) {
    logger.error("[Turnstile] Gagal verifikasi:", err.message);
    return false;
  }
}

module.exports = { verifyTurnstile };
