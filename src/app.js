const { validateConfig, config } = require('./config/config');
const logger = require('./frameworks/helpers/logger');
const { connectDatabase } = require('./frameworks/database/prismaClient');
const { connectRedis } = require('./frameworks/tools/redisClient');
const { createServer } = require('./frameworks/webserver/server');

async function bootstrap() {
  try {
    validateConfig();

    await connectDatabase();
    connectRedis();

    const app = createServer();

    app.listen(config.app.port, () => {
      logger.info(`[Server] EMS backend jalan di port ${config.app.port} (${config.app.env})`);
    });
  } catch (err) {
    logger.error('[Bootstrap] Gagal start aplikasi:', err.message);
    process.exit(1);
  }
}

bootstrap();
