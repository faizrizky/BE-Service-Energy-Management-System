const logger = require("../../../src/frameworks/helpers/logger");
const { verifyTurnstile } = require("../../../src/frameworks/security/turnstile");
const { fetchResponse } = require("../../helpers/http");

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.clearAllMocks();
});

describe("verifyTurnstile", () => {
  test("[positive] Cloudflare menjawab success:true -> true", async () => {
    global.fetch.mockResolvedValue(fetchResponse({ body: { success: true } }));
    await expect(verifyTurnstile("token", "1.2.3.4")).resolves.toBe(true);

    const [url, options] = global.fetch.mock.calls[0];
    expect(url).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
    expect(options.method).toBe("POST");
    expect(options.body.get("response")).toBe("token");
    expect(options.body.get("remoteip")).toBe("1.2.3.4");
  });

  test("[negative] token kosong -> false tanpa memanggil Cloudflare", async () => {
    await expect(verifyTurnstile("", "1.2.3.4")).resolves.toBe(false);
    await expect(verifyTurnstile(undefined)).resolves.toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("[negative] Cloudflare menjawab success:false -> false", async () => {
    global.fetch.mockResolvedValue(
      fetchResponse({ body: { success: false, "error-codes": ["invalid-input-response"] } }),
    );
    await expect(verifyTurnstile("bad")).resolves.toBe(false);
  });

  test("[negative] success bukan boolean true (mis. string 'true') -> false", async () => {
    global.fetch.mockResolvedValue(fetchResponse({ body: { success: "true" } }));
    await expect(verifyTurnstile("tok")).resolves.toBe(false);
  });

  test("[negative] tanpa remoteIp -> dikirim string kosong", async () => {
    global.fetch.mockResolvedValue(fetchResponse({ body: { success: true } }));
    await verifyTurnstile("tok");
    expect(global.fetch.mock.calls[0][1].body.get("remoteip")).toBe("");
  });

  test("[negative] network error / timeout -> false & dicatat di log", async () => {
    global.fetch.mockRejectedValue(new Error("timeout"));
    await expect(verifyTurnstile("tok")).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith("[Turnstile] Gagal verifikasi:", "timeout");
  });

  test("[negative] response bukan JSON -> false", async () => {
    global.fetch.mockResolvedValue(fetchResponse({ body: "<html>" }));
    await expect(verifyTurnstile("tok")).resolves.toBe(false);
  });
});
