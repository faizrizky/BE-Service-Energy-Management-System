jest.mock("../../../../src/frameworks/helpers/sessionRevocation", () => ({
  isSessionRevoked: jest.fn(),
}));

const jwt = require("jsonwebtoken");
const { isSessionRevoked } = require("../../../../src/frameworks/helpers/sessionRevocation");
const logger = require("../../../../src/frameworks/helpers/logger");
const authMiddleware = require("../../../../src/frameworks/webserver/middlewares/authMiddleware");
const { mockReq, mockRes, mockNext } = require("../../../helpers/http");

const SECRET = process.env.JWT_SECRET;

async function run(headers) {
  const req = mockReq({ headers, user: undefined });
  const res = mockRes();
  const next = mockNext();
  await authMiddleware(req, res, next);
  return { req, res, next };
}

beforeEach(() => {
  jest.clearAllMocks();
  isSessionRevoked.mockResolvedValue(false);
});

describe("authMiddleware", () => {
  test("[positive] token valid -> req.user berisi payload & next dipanggil", async () => {
    const token = jwt.sign({ id: "u1", roleId: "r1" }, SECRET, { expiresIn: "1h" });
    const { req, res, next } = await run({ authorization: `Bearer ${token}` });

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({ id: "u1", roleId: "r1" });
    expect(res.status).not.toHaveBeenCalled();
  });

  test("[negative] tanpa header Authorization -> 401 token tidak ditemukan", async () => {
    const { res, next } = await run({});
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Token tidak ditemukan" });
    expect(next).not.toHaveBeenCalled();
  });

  test.each([
    ["skema Basic", "Basic abc"],
    ["tanpa spasi setelah Bearer", "Bearertoken"],
    ["huruf kecil 'bearer'", "bearer token"],
  ])("[negative] %s -> 401 token tidak ditemukan", async (_, header) => {
    const { res, next } = await run({ authorization: header });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("[negative] token ditandatangani secret lain -> 401 token tidak valid", async () => {
    const token = jwt.sign({ id: "u1" }, "secret-lain");
    const { res, next } = await run({ authorization: `Bearer ${token}` });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Token tidak valid atau kadaluarsa",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("[negative] token kadaluarsa -> 401", async () => {
    const token = jwt.sign(
      { id: "u1", exp: Math.floor(Date.now() / 1000) - 60 },
      SECRET,
    );
    const { res } = await run({ authorization: `Bearer ${token}` });
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("[negative] token rusak / bukan JWT -> 401", async () => {
    const { res } = await run({ authorization: "Bearer not.a.jwt" });
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("[negative] 'Bearer ' tanpa token -> 401", async () => {
    const { res } = await run({ authorization: "Bearer " });
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("[positive] token baru dengan sid aktif -> lolos & sid dicek ke daftar cabut", async () => {
    const token = jwt.sign({ id: "u1", sid: "rt1" }, SECRET, { expiresIn: "1h" });
    const { req, next } = await run({ authorization: `Bearer ${token}` });
    expect(isSessionRevoked).toHaveBeenCalledWith("rt1");
    expect(next).toHaveBeenCalledWith();
    expect(req.user.sid).toBe("rt1");
  });

  test("[negative] sesi udah dicabut lewat logout -> 401 walau token belum kadaluarsa (TS-006)", async () => {
    isSessionRevoked.mockResolvedValue(true);
    const token = jwt.sign({ id: "u1", sid: "rt1" }, SECRET, { expiresIn: "1h" });
    const { req, res, next } = await run({ authorization: `Bearer ${token}` });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Sesi sudah berakhir, silakan login ulang" });
    expect(next).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  test("[negative] Redis error -> 503 (nolak, bukan ngelolosin) & dicatat", async () => {
    isSessionRevoked.mockRejectedValue(new Error("ECONNREFUSED"));
    const token = jwt.sign({ id: "u1", sid: "rt1" }, SECRET, { expiresIn: "1h" });
    const { res, next } = await run({ authorization: `Bearer ${token}` });
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith("[Auth] Gagal cek status sesi di Redis:", "ECONNREFUSED");
  });

  test("[negative] token tidak valid -> nggak sampai nanya Redis", async () => {
    await run({ authorization: "Bearer not.a.jwt" });
    expect(isSessionRevoked).not.toHaveBeenCalled();
  });
});
