const jwt = require("jsonwebtoken");
const authMiddleware = require("../../../../src/frameworks/webserver/middlewares/authMiddleware");
const { mockReq, mockRes, mockNext } = require("../../../helpers/http");

const SECRET = process.env.JWT_SECRET;

function run(headers) {
  const req = mockReq({ headers, user: undefined });
  const res = mockRes();
  const next = mockNext();
  authMiddleware(req, res, next);
  return { req, res, next };
}

describe("authMiddleware", () => {
  test("[positive] token valid -> req.user berisi payload & next dipanggil", () => {
    const token = jwt.sign({ id: "u1", roleId: "r1" }, SECRET, { expiresIn: "1h" });
    const { req, res, next } = run({ authorization: `Bearer ${token}` });

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toMatchObject({ id: "u1", roleId: "r1" });
    expect(res.status).not.toHaveBeenCalled();
  });

  test("[negative] tanpa header Authorization -> 401 token tidak ditemukan", () => {
    const { res, next } = run({});
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Token tidak ditemukan" });
    expect(next).not.toHaveBeenCalled();
  });

  test.each([
    ["skema Basic", "Basic abc"],
    ["tanpa spasi setelah Bearer", "Bearertoken"],
    ["huruf kecil 'bearer'", "bearer token"],
  ])("[negative] %s -> 401 token tidak ditemukan", (_, header) => {
    const { res, next } = run({ authorization: header });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("[negative] token ditandatangani secret lain -> 401 token tidak valid", () => {
    const token = jwt.sign({ id: "u1" }, "secret-lain");
    const { res, next } = run({ authorization: `Bearer ${token}` });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Token tidak valid atau kadaluarsa",
    });
    expect(next).not.toHaveBeenCalled();
  });

  test("[negative] token kadaluarsa -> 401", () => {
    const token = jwt.sign(
      { id: "u1", exp: Math.floor(Date.now() / 1000) - 60 },
      SECRET,
    );
    const { res } = run({ authorization: `Bearer ${token}` });
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("[negative] token rusak / bukan JWT -> 401", () => {
    const { res } = run({ authorization: "Bearer not.a.jwt" });
    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("[negative] 'Bearer ' tanpa token -> 401", () => {
    const { res } = run({ authorization: "Bearer " });
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
