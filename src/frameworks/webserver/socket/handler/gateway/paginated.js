const gatewayUseCase = require("../../../../../application/use_cases/gateway/gateway.usecase");
const logger = require("../../../../helpers/logger");

const gatewayPaginatedSocket = (io, socket) => {
  socket.on("gateway:list", async (params = {}) => {
    logger.info("[Socket][Event] gateway:list accepted:", params);

    try {
      const {
        page = 1, 
        rowsPerPage = 10, 
        search,
        createdFrom,
        createdTo,
      } = params || {};

      const gateway = await gatewayUseCase.listGatewaysPaginated({
        page: Number(page),
        rowsPerPage: Number(rowsPerPage),
        search,
        createdFrom,
        createdTo,
      });

      logger.info("[Socket][Event] gateway:list Query done:", {
        totalRows: gateway.totalRows,
        page: gateway.page,
        rowsPerPage: gateway.rowsPerPage,
      });

      // send response only to client
      socket.emit("gateway:list", gateway);
    } catch (error) {
      logger.error("[Socket][Event] gateway:list Failed:", error.stack || error);

      socket.emit("gateway:list:error", { message: "Gagal mengambil data gateway" });
    }
  });
};

module.exports = gatewayPaginatedSocket;