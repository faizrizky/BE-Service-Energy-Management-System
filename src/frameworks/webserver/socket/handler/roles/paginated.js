const roleUseCase = require("../../../../../application/use_cases/role/role.usecase");
const logger = require("../../../../helpers/logger");

const rolePaginatedSocket = (io, socket) => {
  socket.on("role:list", async (params = {}) => {
    logger.info("[Socket][Event] role:list accepted:", params);

    try {
      const {
        page = 1, 
        rowsPerPage = 10, 
        search
      } = params || {};

      const roles = await roleUseCase.listRolesPaginated({
        page: Number(page),
        rowsPerPage: Number(rowsPerPage),
        search
      });

      logger.info("[Socket][Event] role:list Query done:", {
        totalRows: roles.totalRows,
        page: roles.page,
        rowsPerPage: roles.rowsPerPage,
      });

      // send response only to client
      socket.emit("role:list", roles);
    } catch (error) {
      logger.error("[Socket][Event] role:list Failed:", error.stack || error);

      socket.emit("role:list:error", { message: "Gagal mengambil data roles" });
    }
  });
};

module.exports = rolePaginatedSocket;