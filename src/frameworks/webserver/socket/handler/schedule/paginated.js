const scheduleUseCase = require("../../../../../application/use_cases/schedule/schedule.usecase");
const logger = require("../../../../helpers/logger");

const schedulePaginatedSocket = (io, socket) => {
  socket.on("schedule:list", async (params = {}) => {
    logger.info("[Socket][Event] schedule:list accepted:", params);

    try {
      const {
        roomId,
        page = 1,
        rowsPerPage = 10,
        search,
        status,
        scheduledFrom,
        scheduledTo,
      } = params || {};

      const schedules = await scheduleUseCase.listSchedulesPaginated({
        page: Number(page),
        rowsPerPage: Number(rowsPerPage),
        search,
        status,
        scheduledFrom,
        scheduledTo,
      });

      logger.info("[Socket][Event] schedule:list Query done:", {
        totalRows: schedules.totalRows,
        page: schedules.page,
        rowsPerPage: schedules.rowsPerPage,
      });

      // send response only to client
      socket.emit("schedule:list", schedules);
    } catch (error) {
      logger.error("[Socket][Event] schedule:list Failed:", error.stack || error);

      socket.emit("schedule:list:error", { message: "Gagal mengambil data schedule" });
    }
  });
};

module.exports = schedulePaginatedSocket;