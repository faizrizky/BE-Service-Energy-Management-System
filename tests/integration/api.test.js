/**
 * Uji integrasi HTTP: server Express sungguhan (routing, helmet, CORS, rate limit,
 * auth, RBAC, validasi, error handler) dengan use case di-mock.
 */
jest.mock("../../src/application/use_cases/authentication/login.usecase", () => ({ login: jest.fn() }));
jest.mock("../../src/application/use_cases/device/device.usecase", () => ({
  listDevicesPaginated: jest.fn(),
  powerDevice: jest.fn(),
  cancelRelayCommand: jest.fn(),
  getDeviceById: jest.fn(),
}));
jest.mock("../../src/application/use_cases/room/room.usecase", () => ({ powerRoom: jest.fn() }));
jest.mock("../../src/application/use_cases/user/user.usecase", () => ({ updateProfile: jest.fn(), createUser: jest.fn() }));
jest.mock("../../src/frameworks/helpers/securityLog", () => ({ logSecurityEvent: jest.fn().mockResolvedValue() }));
jest.mock("../../src/frameworks/tools/redisClient", () => ({
  getRedisClient: () => ({ ping: jest.fn().mockResolvedValue("PONG") }),
}));
jest.mock("../../src/frameworks/chirpstack/client", () => ({ listApplications: jest.fn().mockResolvedValue({}) }));

const jwt = require("jsonwebtoken");
const { prisma } = require("../../src/frameworks/database/prismaClient");
const { login } = require("../../src/application/use_cases/authentication/login.usecase");
const deviceUC = require("../../src/application/use_cases/device/device.usecase");
const roomUC = require("../../src/application/use_cases/room/room.usecase");
const userUC = require("../../src/application/use_cases/user/user.usecase");
const { createServer } = require("../../src/frameworks/webserver/server");

const DEVICE_ID = "3f1c2a9e-8b7d-4c6e-9a1b-2d3e4f5a6b7c";
let server;
let baseUrl;

beforeAll(async () => {
  server = createServer().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  jest.clearAllMocks();
  prisma.rolePermission.findFirst.mockReset();
  prisma.$queryRaw.mockResolvedValue([1]);
});

const token = (payload = { id: "user-1", roleId: "role-1" }) => jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

async function request(method, path, { body, auth = true, headers = {}, raw } = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body !== undefined || raw !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(auth ? { Authorization: `Bearer ${typeof auth === "string" ? auth : token()}` } : {}),
      ...headers,
    },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  return { status: res.status, headers: res.headers, body: json, text };
}

describe("infrastruktur HTTP", () => {
  test("[positive] /health publik -> 200 & header keamanan helmet", async () => {
    const res = await request("GET", "/health", { auth: false });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ app: "ok", database: "ok", redis: "ok", chirpstack: "ok" });
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-powered-by")).toBeNull();
  });

  test("[negative] route tidak dikenal -> 404 JSON", async () => {
    const res = await request("GET", "/api/tidak-ada", { auth: false });
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Route GET /api/tidak-ada tidak ditemukan");
  });

  test("[negative] JSON rusak -> 400 (bukan 500)", async () => {
    const res = await request("POST", "/api/auth/login", { auth: false, raw: "{rusak" });
    expect(res.status).toBe(400);
  });

  test("[negative] body > 1MB -> 413", async () => {
    const res = await request("POST", "/api/auth/login", { auth: false, body: { username: "a".repeat(1_100_000), password: "x" } });
    expect(res.status).toBe(413);
  });

  test("[positive] CORS dengan ALLOWED_ORIGINS kosong memantulkan origin apa pun + credentials", async () => {
    const res = await request("GET", "/health", { auth: false, headers: { Origin: "https://siapa-saja.test" } });
    expect(res.headers.get("access-control-allow-origin")).toBe("https://siapa-saja.test");
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
  });
});

describe("auth", () => {
  test("[positive] login valid -> 200 data dari use case", async () => {
    login.mockResolvedValue({ accessToken: "a", refreshToken: "b" });
    const res = await request("POST", "/api/auth/login", { auth: false, body: { username: "admin", password: "admin" } });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ data: { accessToken: "a", refreshToken: "b" } });
  });

  test("[negative] login tanpa password -> 400 validasi, use case tidak dipanggil", async () => {
    const res = await request("POST", "/api/auth/login", { auth: false, body: { username: "admin" } });
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual([expect.objectContaining({ field: "password" })]);
    expect(login).not.toHaveBeenCalled();
  });

  // Kuota authLimiter (10/IP) dihitung dari semua respons >= 400 pada /login,
  // termasuk 400 validasi di test sebelumnya, jadi posisi 429 pertama tidak dipatok.
  test("[negative] login salah terus -> 401 lalu dibatasi 429 maksimal setelah 10 percobaan gagal", async () => {
    login.mockRejectedValue(Object.assign(new Error("Username/Email atau password salah"), { status: 401 }));
    const statuses = [];
    for (let i = 0; i < 11; i += 1) {
      statuses.push((await request("POST", "/api/auth/login", { auth: false, body: { username: "brute", password: `p${i}` } })).status);
    }
    const firstLimited = statuses.indexOf(429);
    expect(firstLimited).toBeGreaterThan(0);
    expect(firstLimited).toBeLessThanOrEqual(10);
    expect(statuses.slice(0, firstLimited).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(firstLimited).every((s) => s === 429)).toBe(true);
    expect(login).toHaveBeenCalledTimes(firstLimited);
  });
});

describe("proteksi endpoint (auth + RBAC)", () => {
  test("[negative] tanpa token -> 401", async () => {
    const res = await request("GET", "/api/devices", { auth: false });
    expect(res.status).toBe(401);
    expect(deviceUC.listDevicesPaginated).not.toHaveBeenCalled();
  });

  test("[negative] token dari secret lain -> 401", async () => {
    const forged = jwt.sign({ id: "hacker", roleId: "role-1" }, "bukan-secret");
    expect((await request("GET", "/api/devices", { auth: forged })).status).toBe(401);
  });

  test("[negative] role tanpa permission device.view -> 403", async () => {
    prisma.rolePermission.findFirst.mockResolvedValue(null);
    const res = await request("GET", "/api/devices");
    expect(res.status).toBe(403);
    expect(prisma.rolePermission.findFirst).toHaveBeenCalledWith({
      where: { roleId: "role-1", permission: { module: "device", action: "view" } },
    });
  });

  test("[positive] role dengan permission -> 200, query diteruskan", async () => {
    prisma.rolePermission.findFirst.mockResolvedValue({});
    deviceUC.listDevicesPaginated.mockResolvedValue({ data: [], page: 2 });
    const res = await request("GET", "/api/devices?page=2&search=AC");
    expect(res.status).toBe(200);
    expect(deviceUC.listDevicesPaginated).toHaveBeenCalledWith(expect.objectContaining({ page: 2, search: "AC" }));
  });

  test("[positive] PUT /api/users/me hanya perlu login (tanpa RBAC)", async () => {
    userUC.updateProfile.mockResolvedValue({ id: "user-1" });
    const res = await request("PUT", "/api/users/me", { body: { fullName: "Budi" } });
    expect(res.status).toBe(200);
    expect(prisma.rolePermission.findFirst).not.toHaveBeenCalled();
    expect(userUC.updateProfile).toHaveBeenCalledWith("user-1", { fullName: "Budi" });
  });

  test("[negative] POST /api/users butuh permission user.create", async () => {
    prisma.rolePermission.findFirst.mockResolvedValue(null);
    expect((await request("POST", "/api/users", { body: {} })).status).toBe(403);
    expect(userUC.createUser).not.toHaveBeenCalled();
  });
});

describe("power device & room", () => {
  beforeEach(() => prisma.rolePermission.findFirst.mockResolvedValue({}));

  test("[positive] POST /devices/:id/power -> 202 pending", async () => {
    deviceUC.powerDevice.mockResolvedValue({ commandId: "c1", status: "pending" });
    const res = await request("POST", `/api/devices/${DEVICE_ID}/power`, { body: { action: "on" } });
    expect(res.status).toBe(202);
    expect(deviceUC.powerDevice).toHaveBeenCalledWith(DEVICE_ID, "on", { userId: "user-1" });
    expect(prisma.rolePermission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ permission: { module: "device", action: "power_control" } }) }),
    );
  });

  test("[negative] action tidak valid -> 400 dari middleware validasi", async () => {
    const res = await request("POST", `/api/devices/${DEVICE_ID}/power`, { body: { action: "restart" } });
    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toEqual({ field: "action", message: 'action harus "on" atau "off"' });
    expect(deviceUC.powerDevice).not.toHaveBeenCalled();
  });

  test("[negative] error 409/404 dari use case diteruskan dengan status & pesan", async () => {
    deviceUC.powerDevice.mockRejectedValue(Object.assign(new Error("Device belum terhubung ke ChirpStack (devEUI kosong)"), { status: 409 }));
    const res = await request("POST", `/api/devices/${DEVICE_ID}/power`, { body: { action: "off" } });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain("devEUI kosong");
  });

  test("[negative] error tak terduga -> 500 generik", async () => {
    deviceUC.powerDevice.mockRejectedValue(new Error("TypeError internal"));
    const res = await request("POST", `/api/devices/${DEVICE_ID}/power`, { body: { action: "off" } });
    expect(res.status).toBe(500);
    expect(res.body.message).toBe("Terjadi kesalahan pada server");
  });

  test("[positive/negative] cancel: 200 kalau ada pending, 404 kalau tidak", async () => {
    deviceUC.cancelRelayCommand.mockResolvedValueOnce({ cancelled: [{}] });
    expect((await request("POST", `/api/devices/${DEVICE_ID}/power/cancel`)).status).toBe(200);
    deviceUC.cancelRelayCommand.mockRejectedValueOnce(Object.assign(new Error("Tidak ada perintah"), { status: 404 }));
    expect((await request("POST", `/api/devices/${DEVICE_ID}/power/cancel`)).status).toBe(404);
  });

  test("[positive] route telemetry & interval sudah benar (/:id/..), bukan 404", async () => {
    prisma.rolePermission.findFirst.mockResolvedValue(null);
    expect((await request("POST", `/api/devices/${DEVICE_ID}/telemetry`, { body: {} })).status).toBe(403);
    expect((await request("POST", `/api/devices/${DEVICE_ID}/interval`, { body: {} })).status).toBe(403);
  });

  test("[positive] POST /rooms/:id/power -> 202 bila ada pending", async () => {
    roomUC.powerRoom.mockResolvedValue({ summary: { total: 1, pending: 1, failed: 0 }, results: [] });
    const res = await request("POST", "/api/rooms/r1/power", { body: { action: "off" } });
    expect(res.status).toBe(202);
    expect(roomUC.powerRoom).toHaveBeenCalledWith("r1", "off", { userId: "user-1" });
  });

  test("[negative] powerLimiter: > 20 perintah/menit per user -> 429", async () => {
    deviceUC.powerDevice.mockResolvedValue({ status: "pending" });
    const spammer = token({ id: "spammer", roleId: "role-1" });
    const statuses = [];
    for (let i = 0; i < 21; i += 1) {
      statuses.push((await request("POST", `/api/devices/${DEVICE_ID}/power`, { auth: spammer, body: { action: "on" } })).status);
    }
    expect(statuses.filter((s) => s === 202)).toHaveLength(20);
    expect(statuses[20]).toBe(429);
  });
});
