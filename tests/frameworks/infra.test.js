jest.mock("../../src/application/use_cases/authentication/refreshToken.usecase", () => ({ refreshAccessToken: jest.fn() }));
jest.mock("../../src/application/use_cases/authentication/getMe.usecase", () => ({ getMe: jest.fn() }));
jest.mock("../../src/frameworks/tools/redisClient", () => ({
  getRedisClient: () => ({ ping: jest.fn().mockResolvedValue("PONG") }),
}));
jest.mock("../../src/frameworks/chirpstack/client", () => ({ listApplications: jest.fn().mockResolvedValue({}) }));

const jwt = require("jsonwebtoken");
const { prisma } = require("../../src/frameworks/database/prismaClient");
const { config } = require("../../src/config/config");
const logger = require("../../src/frameworks/helpers/logger");
const { refreshAccessToken } = require("../../src/application/use_cases/authentication/refreshToken.usecase");
const { getMe } = require("../../src/application/use_cases/authentication/getMe.usecase");
const { createServer } = require("../../src/frameworks/webserver/server");

async function withServer(fn) {
  const server = createServer().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  prisma.$queryRaw.mockResolvedValue([1]);
});

afterEach(() => {
  config.app.forceHttps = false;
  config.cors.allowedOrigins = [];
});

describe("server: HTTPS & CORS", () => {
  test("[positive] FORCE_HTTPS aktif & request lewat proxy HTTPS -> dilayani", async () => {
    config.app.forceHttps = true;
    await withServer(async (base) => {
      const res = await fetch(`${base}/health`, { headers: { "x-forwarded-proto": "https" } });
      expect(res.status).toBe(200);
    });
  });

  // fetch tidak mengizinkan header Host custom, jadi host yang dipakai adalah host server test.
  test("[negative] FORCE_HTTPS aktif & request HTTP -> redirect 301 ke https dengan path & query utuh", async () => {
    config.app.forceHttps = true;
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/devices?page=2`, { redirect: "manual" });
      expect(res.status).toBe(301);
      expect(res.headers.get("location")).toBe(`https://${new URL(base).host}/api/devices?page=2`);
    });
  });

  test("[positive] origin terdaftar -> header CORS dipantulkan", async () => {
    config.cors.allowedOrigins = ["https://ems.test"];
    await withServer(async (base) => {
      const res = await fetch(`${base}/health`, { headers: { Origin: "https://ems.test" } });
      expect(res.headers.get("access-control-allow-origin")).toBe("https://ems.test");
    });
  });

  // Origin ditolak diteruskan sebagai Error biasa -> errorHandler menjawab 500, bukan 403.
  test("[negative] origin tidak terdaftar -> request ditolak (saat ini 500 generik)", async () => {
    config.cors.allowedOrigins = ["https://ems.test"];
    await withServer(async (base) => {
      const res = await fetch(`${base}/health`, { headers: { Origin: "https://evil.test" } });
      expect(res.status).toBe(500);
      expect(res.headers.get("access-control-allow-origin")).toBeNull();
    });
  });

  test.failing("[BUG] origin CORS yang ditolak seharusnya 403, bukan 500", async () => {
    config.cors.allowedOrigins = ["https://ems.test"];
    await withServer(async (base) => {
      const res = await fetch(`${base}/health`, { headers: { Origin: "https://evil.test" } });
      expect(res.status).toBe(403);
    });
  });
});

describe("rate limiter refresh & me", () => {
  test("[positive/negative] refresh dibatasi per token (10/menit), token lain tetap dilayani", async () => {
    refreshAccessToken.mockResolvedValue({ accessToken: "a", refreshToken: "b" });
    await withServer(async (base) => {
      const send = (refreshToken) =>
        fetch(`${base}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });

      const statuses = [];
      for (let i = 0; i < 11; i += 1) statuses.push((await send("token-yang-sama-1234567890")).status);
      expect(statuses.slice(0, 10).every((s) => s === 200)).toBe(true);
      expect(statuses[10]).toBe(429);
      expect((await send("token-lain-abcdefghijklmn")).status).toBe(200);
    });
  });

  test("[negative] body refresh tanpa token -> 400 validasi (kunci limiter fallback ke IP)", async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/api/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      expect(res.status).toBe(400);
      expect(refreshAccessToken).not.toHaveBeenCalled();
    });
  });

  test("[positive/negative] /auth/me dibatasi 60/menit per user", async () => {
    getMe.mockResolvedValue({ id: "u1" });
    const auth = { Authorization: `Bearer ${jwt.sign({ id: "u-me", roleId: "r1" }, process.env.JWT_SECRET)}` };
    await withServer(async (base) => {
      const statuses = [];
      for (let i = 0; i < 61; i += 1) statuses.push((await fetch(`${base}/api/auth/me`, { headers: auth })).status);
      expect(statuses.filter((s) => s === 200)).toHaveLength(60);
      expect(statuses[60]).toBe(429);
    });
  });
});

describe("redisClient & prismaClient", () => {
  test("[negative] getRedisClient sebelum connect -> error", () => {
    jest.isolateModules(() => {
      const { getRedisClient } = jest.requireActual("../../src/frameworks/tools/redisClient");
      expect(() => getRedisClient()).toThrow("Redis client belum diinisialisasi");
    });
  });

  test("[positive] connectRedis memakai config & mencatat event connect/error", () => {
    jest.isolateModules(() => {
      const Redis = require("ioredis");
      const { connectRedis, getRedisClient } = jest.requireActual("../../src/frameworks/tools/redisClient");
      const log = require("../../src/frameworks/helpers/logger");
      const client = connectRedis();

      expect(Redis).toHaveBeenCalledWith({ host: "127.0.0.1", port: 6379, password: undefined, maxRetriesPerRequest: null });
      expect(getRedisClient()).toBe(client);
      const handlers = Object.fromEntries(client.on.mock.calls);
      handlers.connect();
      handlers.error(new Error("NOAUTH"));
      expect(log.info).toHaveBeenCalledWith("[Redis] Terhubung ke Redis");
      expect(log.error).toHaveBeenCalledWith("[Redis] Connection error:", "NOAUTH");
    });
  });

  test("[positive/negative] connect & disconnect database meneruskan hasil/error Prisma", async () => {
    let mod;
    const instance = { $connect: jest.fn().mockResolvedValue(), $disconnect: jest.fn().mockResolvedValue() };
    jest.isolateModules(() => {
      jest.doMock("@prisma/client", () => ({ PrismaClient: jest.fn(() => instance) }));
      mod = jest.requireActual("../../src/frameworks/database/prismaClient");
    });
    await mod.connectDatabase();
    await mod.disconnectDatabase();
    expect(instance.$connect).toHaveBeenCalled();
    expect(instance.$disconnect).toHaveBeenCalled();

    instance.$connect.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(mod.connectDatabase()).rejects.toThrow("ECONNREFUSED");
  });

  test("[positive] logger menulis ke console dengan level & timestamp", () => {
    const real = jest.requireActual("../../src/frameworks/helpers/logger");
    const spies = ["log", "warn", "error"].map((m) => jest.spyOn(console, m).mockImplementation(() => {}));
    real.info("a");
    real.warn("b");
    real.error("c");
    expect(spies[0].mock.calls[0][0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T.*\] \[INFO\]$/);
    expect(spies[1].mock.calls[0][0]).toContain("[WARN]");
    expect(spies[2].mock.calls[0][0]).toContain("[ERROR]");
    spies.forEach((s) => s.mockRestore());
    expect(logger.info).not.toHaveBeenCalled();
  });
});
