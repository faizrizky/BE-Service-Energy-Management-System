const logger = require("../../../src/frameworks/helpers/logger");
const {
  errorHandler,
  notFoundHandler,
} = require("../../../src/frameworks/webserver/errorHandler");
const { mockReq, mockRes } = require("../../helpers/http");

const originalEnv = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = originalEnv;
  jest.clearAllMocks();
});

describe("errorHandler", () => {
  test("[positive] error dengan status 4xx -> status & message diteruskan", () => {
    const err = Object.assign(new Error("Device tidak ditemukan"), { status: 404 });
    const res = mockRes();
    errorHandler(err, mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Device tidak ditemukan",
      detail: "Device tidak ditemukan",
    });
    expect(logger.error).toHaveBeenCalled();
  });

  test("[negative] error tanpa status -> 500 dengan pesan generik", () => {
    const res = mockRes();
    errorHandler(new Error("SQL syntax error"), mockReq(), res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBe("Terjadi kesalahan pada server");
  });

  test("[negative] production -> detail internal TIDAK bocor", () => {
    process.env.NODE_ENV = "production";
    const res = mockRes();
    errorHandler(new Error("SQL syntax error"), mockReq(), res, jest.fn());
    expect(res.json).toHaveBeenCalledWith({ message: "Terjadi kesalahan pada server" });
  });

  test("[negative] error tanpa stack tetap tercatat pakai message", () => {
    const err = { message: "plain object error", status: 400 };
    errorHandler(err, mockReq(), mockRes(), jest.fn());
    expect(logger.error).toHaveBeenCalledWith("plain object error");
  });
});

describe("notFoundHandler", () => {
  test("[negative] route tidak dikenal -> 404 menyebut method & url", () => {
    const res = mockRes();
    notFoundHandler(mockReq({ method: "DELETE", originalUrl: "/api/nope" }), res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Route DELETE /api/nope tidak ditemukan",
    });
  });
});
