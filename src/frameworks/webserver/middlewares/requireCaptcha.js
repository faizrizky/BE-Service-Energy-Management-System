const { verifyTurnstile } = require("../../security/turnstile");
const { config } = require("../../../config/config");
const { logSecurityEvent } = require("../../helpers/securityLog");

/**
 * Wajibin captcha Turnstile yang valid kalo TURNSTILE_SECRET_KEY diisi; bales
 * 400 & nyatet security log kalo gagal. Kalo key-nya kosong, langsung lanjut.
 *
 * Dipake di: auth.routes.js → POST /api/auth/login.
 */
async function requireCaptcha(req, res, next) {
  if (!config.turnstile.enabled) return next();

  const ok = await verifyTurnstile(req.body.captchaToken, req.ip);
  if (!ok) {
    await logSecurityEvent({
      type: "captcha_failed",
      username: req.body.username,
      req,
    });
    return res
      .status(400)
      .json({ message: "Verifikasi captcha gagal, coba lagi" });
  }
  next();
}

module.exports = requireCaptcha;
