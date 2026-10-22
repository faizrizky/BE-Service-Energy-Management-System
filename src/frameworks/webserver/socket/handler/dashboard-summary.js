const reportUseCase = require("../../../../application/use_cases/report/report.usecase");
const logger = require("../../../helpers/logger");

const dashboardSummarySocket = (io, socket) => {
  socket.on("dashboard:summary", async () => {
    try {
      const summary = await reportUseCase.getDashboardSummary();

      // send response only to client
      socket.emit("dashboard:summary", summary);
    } catch (error) {
      logger.error("[Socket][Event] dashboard:summary Failed:", error.stack || error);

      socket.emit("dashboard:summary:error", { message: "Gagal mengambil data dashboard summary" });
    }
  });
};

module.exports = dashboardSummarySocket;