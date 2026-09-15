const jwt = require("jsonwebtoken");

jest.mock("socket.io", () => ({
  Server: jest.fn().mockImplementation((httpServer, opts) => {
    const io = { httpServer, opts, middlewares: [], handlers: {}, emit: jest.fn() };
    io.use = jest.fn((fn) => io.middlewares.push(fn));
    io.on = jest.fn((event, fn) => {
      io.handlers[event] = fn;
    });
    return io;
  }),
}));

const { config } = require("../../../src/config/config");
const logger = require("../../../src/frameworks/helpers/logger");

// config ikut di-require di dalam isolateModules supaya instance-nya sama dengan yang dipakai socket.js.
function loadSocket() {
  let mod;
  jest.isolateModules(() => {
    mod = {
      ...require("../../../src/frameworks/webserver/socket"),
      config: require("../../../src/config/config").config,
    };
  });
  return mod;
}

function runAuth(io, token) {
  const socket = { handshake: { auth: token === undefined ? {} : { token } } };
  const next = jest.fn();
  io.middlewares[0](socket, next);
  return { socket, next };
}

afterEach(() => {
  config.cors.allowedOrigins = [];
  jest.clearAllMocks();
});

describe("socket", () => {
  test("[negative] getIO sebelum initSocket -> error jelas", () => {
    const { getIO } = loadSocket();
    expect(() => getIO()).toThrow("Socket.io belum diinisialisasi");
  });

  test("[positive] initSocket -> getIO mengembalikan instance yang sama", () => {
    const { initSocket, getIO } = loadSocket();
    const io = initSocket({});
    expect(getIO()).toBe(io);
  });

  test("[positive] token valid -> socket.user terisi", () => {
    const io = loadSocket().initSocket({});
    const token = jwt.sign({ id: "u1" }, process.env.JWT_SECRET);
    const { socket, next } = runAuth(io, token);
    expect(next).toHaveBeenCalledWith();
    expect(socket.user).toMatchObject({ id: "u1" });
  });

  test("[negative] tanpa token / token invalid -> koneksi ditolak", () => {
    const io = loadSocket().initSocket({});
    expect(runAuth(io, undefined).next.mock.calls[0][0].message).toBe("Token tidak ditemukan");
    expect(runAuth(io, "rusak").next.mock.calls[0][0].message).toBe("Token tidak valid atau kadaluarsa");
    const expired = jwt.sign({ id: "u1", exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET);
    expect(runAuth(io, expired).next.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  test("[positive] event connection dicatat", () => {
    const io = loadSocket().initSocket({});
    io.handlers.connection({ id: "sock1", user: { id: "u1" } });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("sock1"));
  });

  test("[positive/negative] CORS origin: daftar kosong izinkan semua; daftar terisi hanya yang cocok", () => {
    const socketModule = loadSocket();
    const io = socketModule.initSocket({});
    const origin = io.opts.cors.origin;
    const cb = jest.fn();

    origin("https://mana-saja.test", cb);
    expect(cb).toHaveBeenLastCalledWith(null, true);

    socketModule.config.cors.allowedOrigins = ["https://ems.test"];
    origin("https://ems.test", cb);
    expect(cb).toHaveBeenLastCalledWith(null, true);
    origin(undefined, cb);
    expect(cb).toHaveBeenLastCalledWith(null, true);
    origin("https://evil.test", cb);
    expect(cb.mock.calls.at(-1)[0]).toBeInstanceOf(Error);
  });
});

describe("socket-events", () => {
  test("[positive] setiap helper emit ke event yang benar", () => {
    jest.isolateModules(() => {
      const io = { emit: jest.fn() };
      jest.doMock("../../../src/frameworks/webserver/socket", () => ({ getIO: () => io }));
      const ev = require("../../../src/frameworks/webserver/socket-events");

      ev.emitDeviceCreated({ id: "d1" });
      ev.emitDeviceUpdated({ id: "d1" });
      ev.emitDeviceDeleted("d1");
      ev.emitDeviceStatus({ deviceId: "d1" });
      ev.emitDeviceCommand({ commandId: "c1" });
      ev.emitRoomCreated({ id: "r1" });
      ev.emitRoomUpdated({ id: "r1" });
      ev.emitRoomDeleted("r1");
      ev.emitRoomPower("r1", []);
      ev.emitGatewayCreated({ id: "g1" });
      ev.emitGatewayUpdated({ id: "g1" });
      ev.emitGatewayDeleted("g1");
      ev.emitScheduleCreated({ id: "s1" });
      ev.emitScheduleUpdated({ id: "s1" });
      ev.emitScheduleDeleted("s1");

      expect(io.emit.mock.calls).toEqual([
        ["device:created", { device: { id: "d1" } }],
        ["device:updated", { device: { id: "d1" } }],
        ["device:deleted", { deviceId: "d1" }],
        ["device:status", { deviceId: "d1" }],
        ["device:command", { commandId: "c1" }],
        ["room:created", { room: { id: "r1" } }],
        ["room:updated", { room: { id: "r1" } }],
        ["room:deleted", { roomId: "r1" }],
        ["room:power", { roomId: "r1", results: [] }],
        ["gateway:created", { gateway: { id: "g1" } }],
        ["gateway:updated", { gateway: { id: "g1" } }],
        ["gateway:deleted", { gatewayId: "g1" }],
        ["schedule:created", { schedule: { id: "s1" } }],
        ["schedule:updated", { schedule: { id: "s1" } }],
        ["schedule:deleted", { scheduleId: "s1" }],
      ]);
    });
  });

  test("[negative] socket belum siap -> emit dicatat error, tidak melempar", () => {
    jest.isolateModules(() => {
      jest.doMock("../../../src/frameworks/webserver/socket", () => ({
        getIO: () => {
          throw new Error("belum init");
        },
      }));
      const ev = require("../../../src/frameworks/webserver/socket-events");
      const log = require("../../../src/frameworks/helpers/logger");
      expect(() => ev.emitDeviceStatus({})).not.toThrow();
      expect(log.error).toHaveBeenCalledWith('[Socket] Gagal emit "device:status":', "belum init");
    });
  });
});
