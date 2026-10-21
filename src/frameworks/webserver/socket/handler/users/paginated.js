const userUseCase = require("../../../../../application/use_cases/user/user.usecase");
const logger = require("../../../../helpers/logger");

const userPaginatedSocket = (io, socket) => {
  socket.on("user:list", async (params = {}) => {
    logger.info("[Socket][Event] user:list accepted:", params);

    try {
      const {
        roleId, page = 1,
        rowsPerPage = 10,
        search, createdFrom, createdTo,
      } = params || {};

      const users = await userUseCase.listUsersPaginated({
        roleId,
        page: Number(page),
        rowsPerPage: Number(rowsPerPage),
        search,
        createdFrom,
        createdTo,
      });

      logger.info("[Socket][Event] user:list Query done:", {
        totalRows: users.totalRows,
        page: users.page,
        rowsPerPage: users.rowsPerPage,
      });

      // send response only to client
      socket.emit("user:list", users);
    } catch (error) {
      logger.error("[Socket][Event] user:list Failed:", error.stack || error);

      socket.emit("user:list:error", { message: "Gagal mengambil data user" });
    }
  });
};

module.exports = userPaginatedSocket;