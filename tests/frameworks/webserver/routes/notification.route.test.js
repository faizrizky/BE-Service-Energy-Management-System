// Test lewat HTTP beneran (express + fetch) biar urutan auth -> permission di route ikut kecek.
jest.mock("../../../../src/frameworks/helpers/sessionRevocation", () => ({
  isSessionRevoked: jest.fn().mockResolvedValue(false),
}));
jest.mock("../../../../src/frameworks/helpers/securityLog", () => ({
  logSecurityEvent: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../../../src/adapters/controllers/notification.controller", () => {
  const ok = (name) => (req, res) => res.status(200).json({ handler: name });
  return {
    store: ok("store"),
    index: ok("index"),
    patchMultipleReadAt: ok("patchMultipleReadAt"),
    show: ok("show"),
    patch: ok("patch"),
    update: ok("update"),
    destroy: ok("destroy"),
  };
});
jest.mock("../../../../src/frameworks/webserver/middlewares/validate", () => () => (req, res, next) => next());

const express = require("express");
const jwt = require("jsonwebtoken");
const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const { resetPrismaMock } = require("../../../helpers/prisma");
const router = require("../../../../src/frameworks/webserver/routes/notification.route");

// Permission per role sesuai prisma/seed.js.
const GRANTS = {
  "r-admin": ["view", "manage"],
  "r-pj": ["view"],
  "r-komandan": [],
};

let server;
let base;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/notifications", router);
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}/api/notifications`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

beforeEach(() => {
  resetPrismaMock(prisma);
  prisma.rolePermission.findFirst.mockImplementation(async ({ where }) =>
    where.permission.module === "notification" && (GRANTS[where.roleId] || []).includes(where.permission.action)
      ? { roleId: where.roleId }
      : null,
  );
});

const tokenFor = (roleId) => jwt.sign({ id: "u1", roleId }, process.env.JWT_SECRET, { expiresIn: "5m" });

async function call(method, path, roleId) {
  const headers = { "Content-Type": "application/json" };
  if (roleId) headers.Authorization = `Bearer ${tokenFor(roleId)}`;
  const res = await fetch(base + path, { method, headers, body: method === "GET" ? undefined : "{}" });
  return res.status;
}

const READ = [
  ["GET", "/"],
  ["GET", "/n1"],
  ["PATCH", "/n1"],
  ["PATCH", "/reads"],
];
const MANAGE = [
  ["POST", "/"],
  ["PUT", "/n1"],
  ["DELETE", "/n1"],
];

describe("notification routes", () => {
  test.each([...READ, ...MANAGE])("[negative] %s %s tanpa token -> 401 (POST nggak lagi publik)", async (method, path) => {
    expect(await call(method, path)).toBe(401);
  });

  test.each([...READ, ...MANAGE])("[negative] Komandan %s %s -> 403 (TS-070)", async (method, path) => {
    expect(await call(method, path, "r-komandan")).toBe(403);
  });

  test.each(READ)("[positive] PJ Gedung boleh %s %s", async (method, path) => {
    expect(await call(method, path, "r-pj")).toBe(200);
  });

  test.each(MANAGE)("[negative] PJ Gedung %s %s -> 403 (khusus Administrator)", async (method, path) => {
    expect(await call(method, path, "r-pj")).toBe(403);
  });

  test.each([...READ, ...MANAGE])("[positive] Administrator boleh %s %s", async (method, path) => {
    expect(await call(method, path, "r-admin")).toBe(200);
  });
});
