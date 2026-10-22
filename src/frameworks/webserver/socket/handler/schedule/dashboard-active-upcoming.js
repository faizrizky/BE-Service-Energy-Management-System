const reportUseCase = require("../../../../../application/use_cases/report/report.usecase");
const logger = require("../../../../helpers/logger");

const dashboardScheduleSocket = (io, socket) => {
  socket.on("dashboard:schedule:status", async (params = {}) => {
    logger.info("[Socket][Event] dashboard:schedule:status accepted:", params);

    try {
      const { status } = params || {};

      const schedules = await reportUseCase.getActiveSchedules({ status });

      // send response only to client
      socket.emit("dashboard:schedule:status", schedules);
    } catch (error) {
      logger.error("[Socket][Event] dashboard:schedule:status Failed:", error.stack || error);

      socket.emit("dashboard:schedule:status:error", { message: "Gagal mengambil data dashboard schedule" });
    }
  });
};

module.exports = dashboardScheduleSocket;