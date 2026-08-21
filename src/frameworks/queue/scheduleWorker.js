const { Worker } = require('bullmq');
const { config } = require('../../config/config');
const { prisma } = require('../database/prismaClient');
const logger = require('../helpers/logger');
const deviceUseCase = require('../../application/use_cases/device/device.usecase');

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

async function executeDueSchedules() {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);

  const dueSchedules = await prisma.schedule.findMany({
    where: { status: 'active', startTime: currentTime },
    include: {
      room: { include: { devices: true } },
      device: true,
    },
  });

  logger.info(`[Scheduler] Cek jam ${currentTime} - ${dueSchedules.length} schedule jatuh tempo`);

  for (const schedule of dueSchedules) {
    const targets = schedule.device ? [schedule.device] : schedule.room.devices;

    for (const device of targets) {
      await deviceUseCase.powerDevice(device.id, schedule.action, { scheduleId: schedule.id });
    }

    logger.info(
      `[Scheduler] Schedule "${schedule.id}" dieksekusi (${targets.length} device, action: ${schedule.action})`,
    );
  }
}

function startScheduleWorker() {
  const worker = new Worker('schedule-executor', executeDueSchedules, { connection });

  worker.on('failed', (job, err) => {
    logger.error('[Scheduler] Job gagal:', err.message);
  });

  logger.info('[Scheduler] Worker jalan, siap eksekusi schedule');

  return worker;
}

module.exports = { startScheduleWorker, executeDueSchedules };