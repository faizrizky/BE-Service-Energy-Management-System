const { prisma } = require("../../../frameworks/database/prismaClient");
const { httpError } = require("../../../frameworks/helpers/httpError");
const {
  timeRangesOverlap,
  occurrenceDatesOverlap,
  getTodayInScheduleZone,
  resolveScheduledDate,
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
    data: schedules,
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
 * Detail schedule plus room sama pembuatnya (tanpa data sensitif). Balikin
 * null kalo nggak ketemu.
 *
 * Dipake di: schedule.controller.js → show (GET /api/schedules/:id).
 */
async function getScheduleById(id) {
  return prisma.schedule.findUnique({
    where: { id },
    include: SCHEDULE_INCLUDE,
  });
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
  emitScheduleCreated(schedule);
  return schedule;
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
  emitScheduleUpdated(schedule);
  return schedule;
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
