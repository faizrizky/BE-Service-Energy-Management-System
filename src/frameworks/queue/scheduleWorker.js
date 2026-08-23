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

// Batas catch-up: kalau server baru nyala / abis downtime lama
const MAX_CATCHUP_MINUTES = 5;

// State di memory: kapan terakhir kali worker ini beneran ngecek.
let lastCheckedAt = null;

/**
 * Bikin daftar timestamp per-menit dari (lastCheckedAt, now]
 */
function getMinutesToCheck(from, to) {
  const floorToMinute = (d) => {
    const copy = new Date(d);
    copy.setSeconds(0, 0);
    return copy;
  };

  const start = from ? floorToMinute(from) : floorToMinute(to);
  const end = floorToMinute(to);

  const minutes = [];
  const cursor = new Date(start);

  if (!from) {
    return [end];
  }

  cursor.setMinutes(cursor.getMinutes() + 1);
  while (cursor <= end) {
    minutes.push(new Date(cursor));
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  if (minutes.length > MAX_CATCHUP_MINUTES) {
    logger.warn(
      `[Scheduler] Catch-up ${minutes.length} menit ketinggalan, dipotong ke ${MAX_CATCHUP_MINUTES} menit terakhir`,
    );
    return minutes.slice(-MAX_CATCHUP_MINUTES);
  }

  return minutes;
}

async function processMinute(minuteDate) {
  const currentTime = minuteDate.toTimeString().slice(0, 5);

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
      startTrigger: isStartDue(schedule, minuteDate),
      endTrigger: isEndDue(schedule, minuteDate),
    }))
    .filter(({ startTrigger, endTrigger }) => startTrigger || endTrigger);

  if (dueSchedules.length === 0) return;

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

async function executeDueSchedules() {
  const now = new Date();
  const minutesToCheck = getMinutesToCheck(lastCheckedAt, now);

  for (const minute of minutesToCheck) {
    await processMinute(minute);
  }

  lastCheckedAt = now;
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
