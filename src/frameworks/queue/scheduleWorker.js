const { Worker } = require("bullmq");
const { config } = require("../../config/config");
const { prisma } = require("../database/prismaClient");
const logger = require("../helpers/logger");
const deviceUseCase = require("../../application/use_cases/device/device.usecase");
const {
  invertAction,
  isStartDue,
  isEndDue,
} = require("../../application/use_cases/schedule/schedule-time.util");

const connection = {
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
};

async function executeDueSchedules() {
  const now = new Date();
  const currentTime = now.toTimeString().slice(0, 5);

  const candidates = await prisma.schedule.findMany({
    where: {
      status: "active",
      OR: [{ startTime: currentTime }, { endTime: currentTime }],
    },
    include: {
      room: { include: { devices: true } },
      device: true,
    },
  });

  const dueSchedules = candidates
    .map((schedule) => ({
      schedule,
      startTrigger: isStartDue(schedule, now),
      endTrigger: isEndDue(schedule, now),
    }))
    .filter(({ startTrigger, endTrigger }) => startTrigger || endTrigger);

  logger.info(
    `[Scheduler] Cek jam ${currentTime} - ${dueSchedules.length} schedule jatuh tempo`,
  );

  for (const { schedule, startTrigger, endTrigger } of dueSchedules) {
    const action = startTrigger
      ? schedule.action
      : invertAction(schedule.action);
    const targets = schedule.device ? [schedule.device] : schedule.room.devices;

    for (const device of targets) {
      await deviceUseCase.powerDevice(device.id, action, {
        scheduleId: schedule.id,
      });
    }

    logger.info(
      `[Scheduler] Schedule "${schedule.id}" dieksekusi (${targets.length} device, action: ${action}, trigger: ${endTrigger ? "endTime" : "startTime"})`,
    );

    const isFullyFinished =
      schedule.repeatType === "none" &&
      (endTrigger || (!schedule.endTime && startTrigger));

    if (isFullyFinished) {
      await prisma.schedule.update({
        where: { id: schedule.id },
        data: { status: "completed" },
      });
      logger.info(
        `[Scheduler] Schedule "${schedule.id}" status diubah ke "completed"`,
      );
    }
  }
}

function startScheduleWorker() {
  const worker = new Worker("schedule-executor", executeDueSchedules, {
    connection,
  });

  worker.on("failed", (job, err) => {
    logger.error("[Scheduler] Job gagal:", err.message);
  });

  logger.info("[Scheduler] Worker jalan, siap eksekusi schedule");

  return worker;
}

module.exports = { startScheduleWorker, executeDueSchedules };
