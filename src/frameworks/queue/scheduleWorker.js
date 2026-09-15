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

const MAX_CATCHUP_MINUTES = 5;

let lastCheckedAt = null;

/**
 * Bikin list menit yang perlu dicek dari pengecekan terakhir sampe sekarang
 * (buat ngejar yang kelewat), maksimal 5 menit terakhir.
 *
 * Dipake di: executeDueSchedules (file ini).
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

/**
 * Jalanin schedule yang jatuh tempo di menit tertentu: kirim perintah ke
 * device/room (action dibalik pas endTime), terus tandain completed buat
 * schedule sekali jalan yang udah kelar.
 *
 * Dipake di: executeDueSchedules (file ini).
 */
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
      try {
        await deviceUseCase.powerDevice(device.id, action, {
          scheduleId: schedule.id,
        });
      } catch (err) {
        logger.warn(
          `[Scheduler] Schedule "${schedule.id}" gagal untuk device ${device.id}: ${err.message}`,
        );
      }
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

/**
 * Processor job scheduler: ngecek semua menit yang belom dicek, terus nyimpen
 * waktu cek terakhir (di memori).
 *
 * Dipake di: startScheduleWorker (processor worker schedule-executor).
 */
async function executeDueSchedules() {
  const now = new Date();
  const minutesToCheck = getMinutesToCheck(lastCheckedAt, now);

  for (const minute of minutesToCheck) {
    await processMinute(minute);
  }

  lastCheckedAt = now;
}

/**
 * Nyalain worker BullMQ schedule-executor dan nyatet job yang gagal.
 *
 * Dipake di: app.js → bootstrap.
 */
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
