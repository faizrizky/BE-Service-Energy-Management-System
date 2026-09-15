jest.mock("../../../../src/frameworks/security/turnstile", () => ({
  verifyTurnstile: jest.fn(),
}));
jest.mock("../../../../src/frameworks/helpers/securityLog", () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
}));

const { config } = require("../../../../src/config/config");
const { verifyTurnstile } = require("../../../../src/frameworks/security/turnstile");
const { logSecurityEvent } = require("../../../../src/frameworks/helpers/securityLog");
const requireCaptcha = require("../../../../src/frameworks/webserver/middlewares/requireCaptcha");
const { mockReq, mockRes, mockNext } = require("../../../helpers/http");

const original = { ...config.turnstile };

afterEach(() => {
  Object.assign(config.turnstile, original);
  jest.clearAllMocks();
});

async function run(body = {}) {
  const req = mockReq({ body, ip: "1.2.3.4" });
  const res = mockRes();
  const next = mockNext();
  await requireCaptcha(req, res, next);
  return { res, next };
}

describe("requireCaptcha", () => {
  test("[positive] captcha dimatikan -> langsung next tanpa verifikasi", async () => {
    config.turnstile.enabled = false;
    const { next } = await run();
    expect(next).toHaveBeenCalled();
    expect(verifyTurnstile).not.toHaveBeenCalled();
  });

  test("[positive] captcha aktif & token valid -> next", async () => {
    config.turnstile.enabled = true;
    verifyTurnstile.mockResolvedValue(true);
    const { next, res } = await run({ captchaToken: "tok" });
    expect(verifyTurnstile).toHaveBeenCalledWith("tok", "1.2.3.4");
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  test("[negative] captcha aktif & token invalid -> 400 + security log", async () => {
    config.turnstile.enabled = true;
    verifyTurnstile.mockResolvedValue(false);
    const { next, res } = await run({ captchaToken: "bad", username: "admin" });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Verifikasi captcha gagal, coba lagi",
    });
    expect(logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "captcha_failed", username: "admin" }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  test("[negative] captcha aktif tanpa token -> diverifikasi dengan undefined & ditolak", async () => {
    config.turnstile.enabled = true;
    verifyTurnstile.mockResolvedValue(false);
    const { res } = await run({});
    expect(verifyTurnstile).toHaveBeenCalledWith(undefined, "1.2.3.4");
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
