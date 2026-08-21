const { Queue } = require('bullmq');
const { config } = require('../../config/config');
const logger = require('../helpers/logger');

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

const scheduleQueue = new Queue('schedule-executor', { connection });

function initRepeatableJob() {
  scheduleQueue.add('check-due-schedules', {}).catch((err) => {
    logger.error('[Scheduler] Gagal add job awal:', err.message);
  });

  setInterval(() => {
    scheduleQueue.add('check-due-schedules', {}).catch((err) => {
      logger.error('[Scheduler] Gagal add job:', err.message);
    });
  }, 60 * 1000);

  logger.info('[Scheduler] Interval trigger aktif (job baru tiap menit)');

  return Promise.resolve();
}

module.exports = { scheduleQueue, initRepeatableJob };