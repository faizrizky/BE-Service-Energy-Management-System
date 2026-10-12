const { Worker } = require("bullmq");
const { config } = require("../../config/config");
const { prisma } = require("../database/prismaClient");
const logger = require("../helpers/logger");
const deviceUseCase = require("../../application/use_cases/device/device.usecase");
const {
  invertAction,
  getZonedParts,
  isStartDue,
  isEndDue,
  isScheduleExpired,
  computeScheduleStatus,
  getScheduleActivity,
  OPEN_SCHEDULE_STATUSES,
} = require("../../application/use_cases/schedule/schedule-time.util");
const {
  SCHEDULE_INCLUDE,
} = require("../../application/use_cases/schedule/schedule.usecase");
const { emitScheduleUpdated } = require("../webserver/socket-events");

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
  const timeZone = config.schedule.timezone;
  const currentTime = getZonedParts(minuteDate, timeZone).time;

  const candidates = await prisma.schedule.findMany({
    where: {
      status: { in: OPEN_SCHEDULE_STATUSES },
      OR: [{ startTime: currentTime }, { endTime: currentTime }],
    },
    include: {
      room: { include: { devices: true } },
    },
  });

  const dueSchedules = candidates
    .map((schedule) => ({
      schedule,
      startTrigger: isStartDue(schedule, minuteDate, timeZone),
      endTrigger: isEndDue(schedule, minuteDate, timeZone),
    }))
    .filter(({ startTrigger, endTrigger }) => startTrigger || endTrigger);

  if (dueSchedules.length === 0) return;

  logger.info(
    `[Scheduler] Cek jam ${currentTime} (${timeZone}) - ${dueSchedules.length} schedule jatuh tempo`,
  );

  for (const { schedule, startTrigger, endTrigger } of dueSchedules) {
    const action = startTrigger
      ? schedule.action
      : invertAction(schedule.action);
    const targets = schedule.room.devices;

    if (targets.length === 0)
      logger.warn(
        `[Scheduler] Schedule "${schedule.name}" (${schedule.id}): room "${schedule.room.name}" tidak memiliki device, tidak ada yang dieksekusi`,
      );

    for (const device of targets) {
      try {
        await deviceUseCase.powerDevice(device.id, action, {
          scheduleId: schedule.id,
          skipIfOffline: true,
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

async function expireMissedSchedules(now) {
  const timeZone = config.schedule.timezone;
  const today = getZonedParts(now, timeZone).date;

  const candidates = await prisma.schedule.findMany({
    where: { status: { in: OPEN_SCHEDULE_STATUSES }, repeatType: "none" },
    select: { id: true, scheduledDate: true, startTime: true, endTime: true },
  });

  const expiredIds = candidates
    .filter((s) => isScheduleExpired(s, today))
    .map((s) => s.id);

  if (expiredIds.length === 0) return;

  await prisma.schedule.updateMany({
    where: { id: { in: expiredIds } },
    data: { status: "completed" },
  });

  logger.warn(
    `[Scheduler] ${expiredIds.length} schedule expired tanpa sempat dieksekusi (kemungkinan server down/kelewat catch-up), ditandain "completed": ${expiredIds.join(", ")}`,
  );
}



/**
 * Samain kolom status schedule yang masih jalan sama computeScheduleStatus
 * (active pas di jendela startTime-endTime hari kemunculannya, upcoming di
 * luar itu), terus ngirim schedule:updated biar frontend pindahin tab-nya
 * otomatis. Jalan abis processMinute & expireMissedSchedules, jadi yang udah
 * completed nggak kesentuh.
 *
 * Dipake di: executeDueSchedules (file ini).
 */
async function syncScheduleStatuses(now) {
  const candidates = await prisma.schedule.findMany({
    where: { status: { in: OPEN_SCHEDULE_STATUSES } },
    select: {
      id: true,
      status: true,
      scheduledDate: true,
      startTime: true,
      endTime: true,
      repeatType: true,
      repeatDays: true,
    },
  });

  const changes = candidates
    .map((schedule) => ({
      id: schedule.id,
      from: schedule.status,
      to: computeScheduleStatus(schedule, now),
    }))
    .filter(({ from, to }) => from !== to);

  for (const { id, from, to } of changes) {
    const updated = await prisma.schedule.update({
      where: { id },
      data: { status: to },
      include: SCHEDULE_INCLUDE,
    });
    emitScheduleUpdated({
      ...updated,
      activity: getScheduleActivity(updated),
    });
    logger.info(
      `[Scheduler] Schedule "${id}" (${updated.name}) status ${from} -> ${to}`,
    );
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

  await expireMissedSchedules(now);
  await syncScheduleStatuses(now);

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

module.exports = {
  startScheduleWorker,
  executeDueSchedules,
  syncScheduleStatuses,
};
