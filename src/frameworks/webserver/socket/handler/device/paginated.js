const deviceUseCase = require("../../../../../application/use_cases/device/device.usecase");
const logger = require("../../../../helpers/logger");

const devicesPaginatedSocket = (io, socket) => {
  socket.on("device:list", async (params = {}) => {
    logger.info("[Socket][Event] device:list accepted:", params);

    try {
      const {
        page = 1,
        rowsPerPage = 10,
        search,
        gatewayId,
        roomId,
        createdFrom,
        createdTo,
      } = params || {};

      const devices = await deviceUseCase.listDevicesPaginated({
        page: Number(page),
        rowsPerPage: Number(rowsPerPage),
        search,
        gatewayId,
        roomId,
        createdFrom,
        createdTo,
      });

      logger.info("[Socket][Event] device:list Query done:", {
        totalRows: devices.totalRows,
        page: devices.page,
        rowsPerPage: devices.rowsPerPage,
      });

      // send response only to client
      socket.emit("device:list", devices);
    } catch (error) {
      logger.error("[Socket][Event] device:list Failed:", error.stack || error);

      socket.emit("device:list:error", { message: "Gagal mengambil data device" });
    }
  });
};

module.exports = devicesPaginatedSocket;