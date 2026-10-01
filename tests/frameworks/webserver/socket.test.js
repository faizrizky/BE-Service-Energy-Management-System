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

jest.mock("../../../src/frameworks/webserver/middlewares/rbacMiddleware", () => {
  const checkPermission = jest.fn();
  checkPermission.roleHasPermission = jest.fn().mockResolvedValue(false);
  return checkPermission;
});
jest.mock("../../../src/frameworks/helpers/sessionRevocation", () => ({
  isSessionRevoked: jest.fn().mockResolvedValue(false),
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

async function runAuth(io, token) {
  const socket = { handshake: { auth: token === undefined ? {} : { token } } };
  const next = jest.fn();
  await io.middlewares[0](socket, next);
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

  test("[positive] token valid -> socket.user terisi", async () => {
    const io = loadSocket().initSocket({});
    const token = jwt.sign({ id: "u1" }, process.env.JWT_SECRET);
    const { socket, next } = await runAuth(io, token);
    expect(next).toHaveBeenCalledWith();
    expect(socket.user).toMatchObject({ id: "u1" });
  });

  test("[negative] tanpa token / token invalid -> koneksi ditolak", async () => {
    const io = loadSocket().initSocket({});
    expect((await runAuth(io, undefined)).next.mock.calls[0][0].message).toBe("Token tidak ditemukan");
    expect((await runAuth(io, "rusak")).next.mock.calls[0][0].message).toBe("Token tidak valid atau kadaluarsa");
    const expired = jwt.sign({ id: "u1", exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET);
    expect((await runAuth(io, expired)).next.mock.calls[0][0]).toBeInstanceOf(Error);
  });

  test("[negative] sesi udah logout -> koneksi socket ditolak (TS-006)", async () => {
    let io;
    let revocation;
    jest.isolateModules(() => {
      revocation = require("../../../src/frameworks/helpers/sessionRevocation");
      io = require("../../../src/frameworks/webserver/socket").initSocket({});
    });
    revocation.isSessionRevoked.mockResolvedValueOnce(true);
    const token = jwt.sign({ id: "u1", sid: "rt1" }, process.env.JWT_SECRET);
    const { socket, next } = await runAuth(io, token);
    expect(revocation.isSessionRevoked).toHaveBeenCalledWith("rt1");
    expect(next.mock.calls[0][0].message).toBe("Sesi sudah berakhir, silakan login ulang");
    expect(socket.user).toBeUndefined();
  });

  test("[positive] event connection dicatat", () => {
    const io = loadSocket().initSocket({});
    io.handlers.connection({ id: "sock1", user: { id: "u1" } });
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining("sock1"));
  });

  test("[positive] role dengan notification.view -> gabung room notification", async () => {
    let io;
    let rbac;
    jest.isolateModules(() => {
      rbac = require("../../../src/frameworks/webserver/middlewares/rbacMiddleware");
      io = require("../../../src/frameworks/webserver/socket").initSocket({});
    });
    rbac.roleHasPermission.mockResolvedValueOnce(true);
    const socket = { id: "sock1", user: { id: "u1", roleId: "r-admin" }, join: jest.fn() };

    await io.handlers.connection(socket);

    expect(rbac.roleHasPermission).toHaveBeenCalledWith("r-admin", "notification", "view");
    expect(socket.join).toHaveBeenCalledWith("notification");
  });

  test("[negative] Komandan (tanpa notification.view) -> nggak gabung room, nggak nerima event notifikasi (TS-070)", async () => {
    let io;
    let rbac;
    jest.isolateModules(() => {
      rbac = require("../../../src/frameworks/webserver/middlewares/rbacMiddleware");
      io = require("../../../src/frameworks/webserver/socket").initSocket({});
    });
    rbac.roleHasPermission.mockResolvedValueOnce(false);
    const socket = { id: "sock2", user: { id: "u2", roleId: "r-komandan" }, join: jest.fn() };

    await io.handlers.connection(socket);

    expect(socket.join).not.toHaveBeenCalled();
  });

  test("[negative] gagal cek izin (DB error) -> cuma warning, koneksi tetap jalan tanpa room", async () => {
    let io;
    let rbac;
    let log;
    jest.isolateModules(() => {
      rbac = require("../../../src/frameworks/webserver/middlewares/rbacMiddleware");
      log = require("../../../src/frameworks/helpers/logger");
      io = require("../../../src/frameworks/webserver/socket").initSocket({});
    });
    rbac.roleHasPermission.mockRejectedValueOnce(new Error("db down"));
    const socket = { id: "sock3", user: { id: "u3", roleId: "r1" }, join: jest.fn() };

    await expect(io.handlers.connection(socket)).resolves.toBeUndefined();
    expect(socket.join).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith("[WebSocket] Gagal cek izin notifikasi: db down");
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

  test("[positive] event notifikasi cuma dikirim ke room notification, bukan broadcast", () => {
    jest.isolateModules(() => {
      const room = { emit: jest.fn() };
      const io = { emit: jest.fn(), to: jest.fn(() => room) };
      jest.doMock("../../../src/frameworks/webserver/socket", () => ({ getIO: () => io }));
      const ev = require("../../../src/frameworks/webserver/socket-events");

      ev.emitNotificationCreated({ id: "n1" });
      ev.emitNotificationPatch({ id: "n1" });

      expect(io.to).toHaveBeenCalledWith("notification");
      expect(room.emit.mock.calls).toEqual([
        ["notif:created", { notif: { id: "n1" } }],
        ["notif:updated", { notif: { id: "n1" } }],
      ]);
      expect(io.emit).not.toHaveBeenCalled();
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
