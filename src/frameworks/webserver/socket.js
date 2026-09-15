const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { config } = require("../../config/config");
const logger = require("../helpers/logger");

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

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Token tidak ditemukan"));

    try {
      socket.user = jwt.verify(token, config.jwt.secret);
      next();
    } catch (err) {
      next(new Error("Token tidak valid atau kadaluarsa"));
    }
  });

  io.on("connection", (socket) => {
    logger.info(
      `[WebSocket] Client terhubung: ${socket.id} (user: ${socket.user?.id})`,
    );
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
