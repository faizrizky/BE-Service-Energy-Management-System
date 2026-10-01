const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { config } = require("../../config/config");
const logger = require("../helpers/logger");
const { isSessionRevoked } = require("../helpers/sessionRevocation");
const { roleHasPermission } = require("./middlewares/rbacMiddleware");

let io;

/**
 * Pasang Socket.IO ke HTTP server, aturan CORS-nya sama kayak REST, dan
 * login-nya pake JWT dari handshake.auth.token.
 *
 * Dipake di: app.js → bootstrap.
 */
function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin(origin, callback) {
        const { allowedOrigins } = config.cors;
        if (
          !origin ||
          allowedOrigins.length === 0 ||
          allowedOrigins.includes(origin)
        ) {
          return callback(null, true);
        }
        callback(new Error("Origin tidak diizinkan"));
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const token =
      socket.handshake.auth?.token || socket.handshake.headers?.access_token;
    if (!token) return next(new Error("Token tidak ditemukan"));

    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      if (await isSessionRevoked(decoded.sid)) {
        return next(new Error("Sesi sudah berakhir, silakan login ulang"));
      }
      socket.user = decoded;
      next();
    } catch (err) {
      next(new Error("Token tidak valid atau kadaluarsa"));
    }
  });

  io.on("connection", async (socket) => {
    logger.info(
      `[WebSocket] Client terhubung: ${socket.id} (user: ${socket.user?.id})`,
    );

    try {
      if (
        await roleHasPermission(socket.user?.roleId, "notification", "view")
      ) {
        socket.join("notification");
      }
    } catch (err) {
      logger.warn(`[WebSocket] Gagal cek izin notifikasi: ${err.message}`);
    }
  });

  return io;
}

/**
 * Ngambil instance Socket.IO. Lempar error kalo initSocket belom dipanggil.
 *
 * Dipake di: socket-events.js → emit.
 */
function getIO() {
  if (!io) {
    throw new Error(
      "Socket.io belum diinisialisasi, panggil initSocket() dulu",
    );
  }
  return io;
}

module.exports = { initSocket, getIO };
