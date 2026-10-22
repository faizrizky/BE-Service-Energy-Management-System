const reportUseCase = require("../../../../application/use_cases/report/report.usecase");
const logger = require("../../../helpers/logger");

const dashboardTopRiskySocket = (io, socket) => {
  socket.on("dashboard:top:risky", async (params = {}) => {
    logger.info("[Socket][Event] dashboard:top:risky accepted:", params);

    try {
        const { range } = params || {};
        const schedules = await reportUseCase.getTopRiskyRooms(range);

        // send response only to client
        socket.emit("dashboard:top:risky", schedules);
    } catch (error) {
      logger.error("[Socket][Event] dashboard:top:risky Failed:", error.stack || error);

      socket.emit("dashboard:top:risky:error", { message: "Gagal mengambil data dashboard summary" });
    }
  });
};

module.exports = dashboardTopRiskySocket;