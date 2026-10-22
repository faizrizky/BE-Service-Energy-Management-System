const roomsleUseCase = require("../../../../../application/use_cases/room/room.usecase");
const logger = require("../../../../helpers/logger");

const roomPaginatedSocket = (io, socket) => {
  socket.on("room:list", async (params = {}) => {
    logger.info("[Socket][Event] room:list accepted:", params);

    try {
        const {
            page = 1,
            rowsPerPage = 10,
            search,
            createdFrom,
            createdTo,
        } = params || {};

      const rooms = await roomsleUseCase.listRoomsPaginated({
        page: Number(page),
        rowsPerPage: Number(rowsPerPage),
        search,
        createdFrom,
        createdTo,
      });

      logger.info("[Socket][Event] room:list Query done:", {
        totalRows: rooms.totalRows,
        page: rooms.page,
        rowsPerPage: rooms.rowsPerPage,
      });

      // send response only to client
      socket.emit("room:list", rooms);
    } catch (error) {
      logger.error("[Socket][Event] room:list Failed:", error.stack || error);

      socket.emit("room:list:error", { message: "Gagal mengambil data rooms" });
    }
  });
};

module.exports = roomPaginatedSocket;