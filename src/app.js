const http = require("http");

const { validateConfig, config } = require("./config/config");
const logger = require("./frameworks/helpers/logger");
const {
  connectDatabase,
  disconnectDatabase,
} = require("./frameworks/database/prismaClient");
const {
  connectRedis,
  getRedisClient,
} = require("./frameworks/tools/redisClient");
const { initSocket } = require("./frameworks/webserver/socket");
const {
  initRepeatableJob,
  scheduleQueue,
} = require("./frameworks/queue/scheduleQueue");
const { startScheduleWorker } = require("./frameworks/queue/scheduleWorker");
const { startRetentionJob } = require("./frameworks/queue/retentionJob");
const { createServer } = require("./frameworks/webserver/server");

let httpServer;
let scheduleWorker;

async function bootstrap() {
  try {
    validateConfig();

    await connectDatabase();
    connectRedis();

    const app = createServer();
    httpServer = http.createServer(app);

    initSocket(httpServer);

    await initRepeatableJob();
    scheduleWorker = startScheduleWorker();
    startRetentionJob();

    httpServer.listen(config.app.port, () => {
      logger.info(
        `[Server] EMS backend jalan di port ${config.app.port} (${config.app.env})`,
      );
    });
  } catch (err) {
    logger.error("[Bootstrap] Gagal start aplikasi:", err.message);
    process.exit(1);
  }
}

async function gracefulShutdown(signal) {
  logger.info(
    `[Shutdown] Menerima ${signal}, mematikan aplikasi dengan aman...`,
  );

  const forceExitTimer = setTimeout(() => {
    logger.error("[Shutdown] Timeout, paksa keluar");
    process.exit(1);
  }, 10_000);

  try {
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
      logger.info("[Shutdown] HTTP server ditutup");
    }

    if (scheduleWorker) {
      await scheduleWorker.close();
      logger.info("[Shutdown] Schedule worker ditutup");
    }

    await scheduleQueue.close();

    await disconnectDatabase();

    try {
      await getRedisClient().quit();
      logger.info("[Shutdown] Redis ditutup");
    } catch (err) {}

    clearTimeout(forceExitTimer);
    logger.info("[Shutdown] Selesai, keluar dengan aman");
    process.exit(0);
  } catch (err) {
    logger.error("[Shutdown] Error saat shutdown:", err.message);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

bootstrap();
