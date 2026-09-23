const { prisma } = require("../../../frameworks/database/prismaClient");
const { httpError } = require("../../../frameworks/helpers/httpError");
const {
  timeRangesOverlap,
  occurrenceDatesOverlap,
  getTodayInScheduleZone,
  resolveScheduledDate,
  invertAction,
  getZonedParts,
} = require("./schedule-time.util");

const {
  emitScheduleCreated,
  emitScheduleUpdated,
  emitScheduleDeleted,
} = require("../../../frameworks/webserver/socket-events");

const SAFE_USER_SELECT = {
  id: true,
  fullName: true,
  username: true,
  email: true,
};

const SCHEDULE_INCLUDE = {
  room: { include: { _count: { select: { devices: true } } } },
  createdBy: { select: SAFE_USER_SELECT },
};

const RECENT_ACTIVITY_LIMIT = 5;
const RECENT_ACTIVITY_SCAN = 50;

/**
 * Bikin filter Prisma buat status active (berulang atau udah mulai) atau
 * upcoming (sekali jalan setelah hari ini). "Hari ini" diitung di zona waktu
 * schedule. Balikin null buat status lain.
 *
 * Dipake di: listSchedulesPaginated (file ini).
 */
function buildStatusWhere(status) {
  if (status !== "active" && status !== "upcoming") return null;

  const todayStart = getTodayInScheduleZone();

  if (status === "upcoming") {
    return {
      status: "active",
      scheduledDate: { gt: todayStart },
    };
  }

  return {
    status: "active",
    scheduledDate: { lte: todayStart },
  };
}

/**
 * Tempelin ringkasan aksi schedule: start = action-nya sendiri, end = aksi
 * kebalikan yang kepicu pas endTime (null kalo gak ada endTime). Aturannya
 * sama persis sama yang dipake scheduleWorker pas eksekusi, diitung di sini
 * biar frontend tinggal nampilin tanpa nurunin aturannya sendiri.
 *
 * Dipake di: listSchedulesPaginated, getScheduleById, createSchedule,
 *   updateSchedule (file ini).
 */
function withActivity(schedule) {
  if (!schedule) return schedule;
  return {
    ...schedule,
    activity: {
      start: schedule.action,
      end: schedule.endTime ? invertAction(schedule.action) : null,
    },
  };
}

/**
 * Ringkas satu kali eksekusi schedule (semua perintah ke device di room pada
 * menit yang sama) jadi satu status + label. Satu jadwal nembak semua device
 * di room, jadi yang ditampilin per eksekusi, bukan per device.
 *
 * Dipake di: getRecentActivity (file ini).
 */
function summarizeExecution(logs) {
  const total = logs.length;
  const count = (status) => logs.filter((log) => log.status === status).length;
  const success = count("success");

  if (count("pending") > 0) {
    return { status: "pending", label: "Waiting for meter confirmation" };
  }
  if (success === total) {
    return { status: "executed", label: "Schedule executed" };
  }
  if (success > 0) {
    return {
      status: "partial",
      label: `Executed on ${success}/${total} devices`,
    };
  }
  if (count("skipped") === total) {
    return { status: "skipped", label: "Skipped, device offline" };
  }
  return { status: "failed", label: "Failed to execute" };
}

/**
 * Riwayat eksekusi terbaru satu schedule, dikelompokin per eksekusi (menit +
 * aksi, di zona waktu schedule) biar jadwal yang nembak banyak device tetap
 * keliatan sebagai satu kejadian. Terbaru duluan.
 *
 * Dipake di: getScheduleById (file ini).
 */
async function getRecentActivity(scheduleId) {
  const logs = await prisma.commandLog.findMany({
    where: { scheduleId },
    orderBy: { executedAt: "desc" },
    take: RECENT_ACTIVITY_SCAN,
  });

  const group = new Map();
  for (const log of logs) {
    const { dateKey, time } = getZonedParts(log.executedAt);
    const key = `${dateKey} ${time} ${log.action}`;
    if (!group.has(key)) {
      group.set(key, {
        key,
        executedAt: log.executedAt,
        date: dateKey,
        time,
        action: log.action,
        logs: [],
      });
    }
    group.get(key).logs.push(log);
  }

  return [...group.values()]
    .slice(0, RECENT_ACTIVITY_LIMIT)
    .map(({ logs: executionLogs, ...entry }) => ({
      ...entry,
      ...summarizeExecution(executionLogs),
    }));
}

/**
 * List schedule pake paginasi, bisa filter room, status, tanggal, sama search
 * (nama, deskripsi, atau nama room).
 *
 * Dipake di: schedule.controller.js → index (GET /api/schedules).
 */
async function listSchedulesPaginated(filter = {}) {
  const {
    roomId,
    page = 1,
    rowsPerPage = 10,
    search,
    status,
    scheduledFrom,
    scheduledTo,
  } = filter;

  const andConditions = [];
  if (roomId) andConditions.push({ roomId });

  const statusWhere = buildStatusWhere(status);
  if (statusWhere) andConditions.push(statusWhere);

  if (scheduledFrom || scheduledTo) {
    const scheduledDate = {};
    if (scheduledFrom) scheduledDate.gte = new Date(scheduledFrom);
    if (scheduledTo) {
      const end = new Date(scheduledTo);
      end.setHours(23, 59, 59, 999);
      scheduledDate.lte = end;
    }
    andConditions.push({ scheduledDate });
  }

  if (search) {
    andConditions.push({
      OR: [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { room: { name: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  const where = andConditions.length ? { AND: andConditions } : {};

  const [totalRows, schedules] = await Promise.all([
    prisma.schedule.count({ where }),
    prisma.schedule.findMany({
      where,
      include: SCHEDULE_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * rowsPerPage,
      take: rowsPerPage,
    }),
  ]);

  return {
    data: schedules.map(withActivity),
    page: Number(page),
    rowsPerPage: Number(rowsPerPage),
    totalRows,
    totalPages: Math.max(1, Math.ceil(totalRows / rowsPerPage)),
  };
}

/**
 * Lempar 409 kalo ada schedule aktif lain di room yang sama yang tabrakan
 * cakupan, tanggal, dan jamnya. excludeId dipake biar schedule nggak dianggep
 * tabrakan sama dirinya sendiri pas update.
 *
 * Dipake di: createSchedule, updateSchedule (file ini).
 */
async function assertNoScheduleConflict(data, excludeId = null) {
  const candidates = await prisma.schedule.findMany({
    where: {
      status: "active",
      roomId: data.roomId,
      ...(excludeId && { id: { not: excludeId } }),
    },
  });

  const target = {
    scheduledDate: data.scheduledDate,
    startTime: data.startTime,
    endTime: data.endTime || null,
    repeatType: data.repeatType || "none",
    repeatDays: data.repeatDays,
  };

  const conflict = candidates.find(
    (existing) =>
      occurrenceDatesOverlap(target, existing) &&
      timeRangesOverlap(
        target.startTime,
        target.endTime,
        existing.startTime,
        existing.endTime,
      ),
  );

  if (conflict) {
    const err = new Error(
      `Jadwal bentrok dengan schedule lain (id: ${conflict.id}, ${conflict.startTime}${
        conflict.endTime ? "-" + conflict.endTime : ""
      })`,
    );
    err.status = 409;
    throw err;
  }
}

/**
 * Validasi aturan schedule yang gak bisa dicek zod: mingguan wajib pilih
 * minimal satu hari, dan endTime gak boleh sama persis dengan startTime.
 * Lempar 400 kalo salah satu dilanggar.
 *
 * Dipake di: createSchedule, updateSchedule (file ini).
 */
function assertScheduleRules({ repeatType, repeatDays, startTime, endTime }) {
  if (
    repeatType === "weekly" &&
    !(Array.isArray(repeatDays) && repeatDays.length > 0)
  ) {
    throw httpError("Jadwal mingguan wajib memilih minimal satu hari", 400);
  }
  if (endTime && endTime === startTime) {
    throw httpError("endTime tidak boleh sama dengan startTime", 400);
  }
}

/**
 * Detail schedule plus room, pembuatnya (tanpa data sensitif), dan riwayat
 * eksekusi terbaru. Balikin null kalo nggak ketemu.
 *
 * Dipake di: schedule.controller.js → show (GET /api/schedules/:id).
 */
async function getScheduleById(id) {
  const [schedule, recentActivity] = await Promise.all([
    prisma.schedule.findUnique({
      where: { id },
      include: SCHEDULE_INCLUDE,
    }),
    getRecentActivity(id),
  ]);
  if (!schedule) return null;
  return { ...withActivity(schedule), recentActivity };
}

/**
 * Bikin schedule abis dicek nggak bentrok (endTime kosong disimpen null,
 * repeatType default none, scheduledDate dihitung otomatis kalo nggak
 * dikirim), terus ngirim event schedule:created.
 *
 * Dipake di: schedule.controller.js → store (POST /api/schedules).
 */
async function createSchedule(data, userId) {
  const repeatType = data.repeatType || "none";
  const endTime = data.endTime || null;

  assertScheduleRules({
    repeatType,
    repeatDays: data.repeatDays,
    startTime: data.startTime,
    endTime,
  });

  const scheduledDate = data.scheduledDate
    ? new Date(data.scheduledDate)
    : resolveScheduledDate({ startTime: data.startTime, repeatType });

  await assertNoScheduleConflict({
    roomId: data.roomId,
    scheduledDate,
    startTime: data.startTime,
    endTime,
    repeatType,
    repeatDays: data.repeatDays,
  });

  const schedule = await prisma.schedule.create({
    data: {
      name: data.name,
      description: data.description || null,
      roomId: data.roomId,
      action: data.action,
      scheduledDate,
      startTime: data.startTime,
      endTime,
      repeatType,
      repeatDays: data.repeatDays || undefined,
      createdById: userId,
    },
    include: SCHEDULE_INCLUDE,
  });
  const created = withActivity(schedule);
  emitScheduleCreated(created);
  return created;
}

/**
 * Gabungin data lama sama perubahan buat cek bentrok, simpen, terus ngirim
 * event schedule:updated. Lempar 404 kalo schedule-nya nggak ada.
 *
 * Dipake di: schedule.controller.js → update (PUT /api/schedules/:id).
 */
async function updateSchedule(id, data) {
  const existing = await prisma.schedule.findUnique({ where: { id } });
  if (!existing) throw httpError("Schedule tidak ditemukan", 404);

  const repeatType = data.repeatType ?? existing.repeatType;
  const startTime = data.startTime ?? existing.startTime;
  const endTime =
    data.endTime !== undefined ? data.endTime || null : existing.endTime;
  const repeatDays =
    data.repeatDays !== undefined ? data.repeatDays : existing.repeatDays;

  assertScheduleRules({ repeatType, repeatDays, startTime, endTime });

  let scheduledDate = data.scheduledDate
    ? new Date(data.scheduledDate)
    : existing.scheduledDate;

  const timingChanged =
    data.repeatType !== undefined || data.startTime !== undefined;

  if (
    !data.scheduledDate &&
    timingChanged &&
    repeatType === "none" &&
    scheduledDate < getTodayInScheduleZone()
  ) {
    scheduledDate = resolveScheduledDate({ startTime, repeatType });
  }

  await assertNoScheduleConflict(
    {
      roomId: data.roomId ?? existing.roomId,
      scheduledDate,
      startTime,
      endTime,
      repeatType,
      repeatDays,
    },
    id,
  );

  const schedule = await prisma.schedule.update({
    where: { id },
    data: {
      name: data.name,
      description:
        data.description === undefined ? undefined : data.description || null,
      roomId: data.roomId,
      action: data.action,
      scheduledDate,
      startTime: data.startTime,
      endTime: data.endTime === undefined ? undefined : data.endTime || null,
      repeatType: data.repeatType,
      repeatDays: data.repeatDays,
      status: data.status,
    },
    include: SCHEDULE_INCLUDE,
  });
  const updated = withActivity(schedule);
  emitScheduleUpdated(updated);
  return updated;
}

/**
 * Hapus schedule terus ngirim event schedule:deleted.
 *
 * Dipake di: schedule.controller.js → destroy (DELETE /api/schedules/:id).
 */
async function deleteSchedule(id) {
  const deleted = await prisma.schedule.delete({ where: { id } });
  emitScheduleDeleted(deleted.id);
  return deleted;
}

module.exports = {
  listSchedulesPaginated,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
};
