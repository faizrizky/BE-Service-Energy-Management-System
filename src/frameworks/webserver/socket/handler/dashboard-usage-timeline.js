const reportUseCase = require("../../../../application/use_cases/report/report.usecase");
const logger = require("../../../helpers/logger");

const dashboardUsageTimelineSocket = (io, socket) => {
  socket.on("dashboard:usage:timeline", async (params = {}) => {
    logger.info("[Socket][Event] dashboard:usage:timeline accepted:", params);

    try {
       const { range } = params || {};
       
        const usageTimeline = await reportUseCase.getEnergyUsageTimeline(range);

        // send response only to client
        socket.emit("dashboard:usage:timeline", usageTimeline);
    } catch (error) {
      logger.error("[Socket][Event] dashboard:usage:timeline Failed:", error.stack || error);

      socket.emit("dashboard:usage:timeline:error", { message: "Gagal mengambil data dashboard summary" });
    }
  });
};

module.exports = dashboardUsageTimelineSocket;