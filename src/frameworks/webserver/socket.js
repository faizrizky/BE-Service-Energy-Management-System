const { Server } = require('socket.io');
const logger = require('../helpers/logger');

let io;

function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    logger.info(`[WebSocket] Client terhubung: ${socket.id}`);
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.io belum diinisialisasi, panggil initSocket() dulu');
  }
  return io;
}

module.exports = { initSocket, getIO };