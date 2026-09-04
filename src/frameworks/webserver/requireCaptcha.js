const { verifyTurnstile } = require("../../security/turnstile");
const { config } = require("../../config/config");

async function requireCaptcha(req, res, next) {
  if (!config.turnstile.enabled) return next();

  const ok = await verifyTurnstile(req.body.captchaToken, req.ip);
  if (!ok) {
    return res
      .status(400)
      .json({ message: "Verifikasi captcha gagal, coba lagi" });
  }
  next();
}

module.exports = { requireCaptcha };
