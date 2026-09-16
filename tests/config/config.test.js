jest.mock("dotenv", () => ({ config: jest.fn() }));

const ENV_KEYS = [
  "PORT",
  "NODE_ENV",
  "FORCE_HTTPS",
  "REDIS_PORT",
  "REDIS_PASSWORD",
  "JWT_EXPIRES_IN",
  "JWT_REFRESH_EXPIRES_DAYS",
  "ENERGY_RETENTION_DAYS",
  "ALLOWED_ORIGINS",
  "RATE_LIMIT_MAX",
  "RATE_LIMIT_POWER_MAX",
  "TURNSTILE_SECRET_KEY",
  "LOGIN_MAX_FAILED_ATTEMPTS",
  "DATABASE_URL",
  "JWT_SECRET",
  "CHIRPSTACK_MIDDLEWARE_URL",
  "CHIRPSTACK_APPLICATION_ID",
  "SCHEDULE_TIMEZONE",
  "CHIRPSTACK_SYNC_DELETE",
  "DEVICE_ONLINE_GRACE_SECONDS",
];

let snapshot;

beforeEach(() => {
  snapshot = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});

afterEach(() => {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function loadConfig(env = {}) {
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  let mod;
  jest.isolateModules(() => {
    mod = require("../../src/config/config");
  });
  return mod;
}

describe("config defaults & parsing", () => {
  test("[positive] env kosong -> memakai default yang aman", () => {
    const { config } = loadConfig({
      PORT: undefined,
      NODE_ENV: undefined,
      FORCE_HTTPS: undefined,
      REDIS_PORT: undefined,
      REDIS_PASSWORD: undefined,
      JWT_EXPIRES_IN: undefined,
      JWT_REFRESH_EXPIRES_DAYS: undefined,
      ENERGY_RETENTION_DAYS: undefined,
      ALLOWED_ORIGINS: undefined,
      RATE_LIMIT_MAX: undefined,
      RATE_LIMIT_POWER_MAX: undefined,
      TURNSTILE_SECRET_KEY: undefined,
      LOGIN_MAX_FAILED_ATTEMPTS: undefined,
    });

    expect(config.app).toEqual({ port: 4000, env: "development", forceHttps: false });
    expect(config.redis.port).toBe(6379);
    expect(config.redis.password).toBeUndefined();
    expect(config.jwt.expiresIn).toBe("1h");
    expect(config.jwt.refreshExpiresDays).toBe(7);
    expect(config.energyRetention.days).toBe(90);
    expect(config.cors.allowedOrigins).toEqual([]);
    expect(config.rateLimit.max).toBe(300);
    expect(config.rateLimit.powerMax).toBe(20);
    expect(config.turnstile.enabled).toBe(false);
    expect(config.loginSecurity.maxFailedAttempts).toBe(5);
    expect(config.schedule.timezone).toBe("Asia/Jakarta");
    expect(config.deviceOnline.graceMs).toBe(120000);
    expect(config.chirpstack.syncDelete).toBe(true);
  });

  test("[positive] nilai env valid di-parse ke tipe yang benar", () => {
    const { config } = loadConfig({
      PORT: "8080",
      FORCE_HTTPS: "true",
      REDIS_PASSWORD: "s3cret",
      TURNSTILE_SECRET_KEY: "turnstile-key",
      RATE_LIMIT_POWER_MAX: "5",
    });
    expect(config.app.port).toBe(8080);
    expect(config.app.forceHttps).toBe(true);
    expect(config.redis.password).toBe("s3cret");
    expect(config.turnstile).toEqual({ secretKey: "turnstile-key", enabled: true });
    expect(config.rateLimit.powerMax).toBe(5);
  });

  test("[positive] ALLOWED_ORIGINS dipisah koma, di-trim, entri kosong dibuang", () => {
    const { config } = loadConfig({
      ALLOWED_ORIGINS: " https://a.test, https://b.test ,, ",
    });
    expect(config.cors.allowedOrigins).toEqual(["https://a.test", "https://b.test"]);
  });

  test("[negative] angka tidak valid -> jatuh ke default, bukan NaN", () => {
    const { config } = loadConfig({ PORT: "abc", RATE_LIMIT_MAX: "lots" });
    expect(config.app.port).toBe(4000);
    expect(config.rateLimit.max).toBe(300);
  });

  test("[negative] FORCE_HTTPS selain 'true' dianggap false", () => {
    expect(loadConfig({ FORCE_HTTPS: "1" }).config.app.forceHttps).toBe(false);
    expect(loadConfig({ FORCE_HTTPS: "TRUE" }).config.app.forceHttps).toBe(false);
  });
});

describe("validateConfig", () => {
  test("[positive] semua env wajib terisi -> tidak melempar", () => {
    const { validateConfig } = loadConfig();
    expect(() => validateConfig()).not.toThrow();
  });

  test('[negative] CHIRPSTACK_SYNC_DELETE="false" -> penghapusan otomatis dimatikan', () => {
    expect(loadConfig({ CHIRPSTACK_SYNC_DELETE: "false" }).config.chirpstack.syncDelete).toBe(false);
  });

  test("[positive] DEVICE_ONLINE_GRACE_SECONDS dipakai buat jendela online", () => {
    expect(loadConfig({ DEVICE_ONLINE_GRACE_SECONDS: "30" }).config.deviceOnline.graceMs).toBe(30000);
  });

  test("[positive] SCHEDULE_TIMEZONE valid (misal UTC) -> tidak melempar", () => {
    const { config, validateConfig } = loadConfig({ SCHEDULE_TIMEZONE: "UTC" });
    expect(config.schedule.timezone).toBe("UTC");
    expect(() => validateConfig()).not.toThrow();
  });

  test("[negative] SCHEDULE_TIMEZONE ngaco -> error nyebut nilainya", () => {
    const { validateConfig } = loadConfig({ SCHEDULE_TIMEZONE: "WIB" });
    expect(() => validateConfig()).toThrow('SCHEDULE_TIMEZONE tidak valid: "WIB"');
  });

  test("[negative] satu env wajib kosong -> error menyebut nama env", () => {
    const { validateConfig } = loadConfig({ JWT_SECRET: undefined });
    expect(() => validateConfig()).toThrow(
      "Environment variable belum diisi: JWT_SECRET",
    );
  });

  test("[negative] beberapa env wajib kosong -> semua disebut sekaligus", () => {
    const { validateConfig } = loadConfig({
      DATABASE_URL: undefined,
      CHIRPSTACK_MIDDLEWARE_URL: undefined,
      CHIRPSTACK_APPLICATION_ID: undefined,
    });
    expect(() => validateConfig()).toThrow(
      "DATABASE_URL, CHIRPSTACK_MIDDLEWARE_URL, CHIRPSTACK_APPLICATION_ID",
    );
  });
});
