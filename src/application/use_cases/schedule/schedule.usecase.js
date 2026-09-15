const { prisma } = require("../../../frameworks/database/prismaClient");
const {
  timeRangesOverlap,
  occurrenceDatesOverlap,
  getTodayInScheduleZone,
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
      repeatType: "none",
      scheduledDate: { gt: todayStart },
    };
  }

  return {
    status: "active",
    OR: [
      { repeatType: { not: "none" } },
      { scheduledDate: { lte: todayStart } },
    ],
  };
}

/**
 * List schedule pake paginasi, bisa filter room, status, tanggal, sama search
 * (nama room/device, EUI, tipe device).
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
        { room: { name: { contains: search, mode: "insensitive" } } },
        { device: { name: { contains: search, mode: "insensitive" } } },
        { device: { eui: { contains: search, mode: "insensitive" } } },
        { device: { deviceType: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  const where = andConditions.length ? { AND: andConditions } : {};

  const [totalRows, schedules] = await Promise.all([
    prisma.schedule.count({ where }),
    prisma.schedule.findMany({
      where,
      include: {
        room: true,
        device: true,
        createdBy: { select: SAFE_USER_SELECT },
      },
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
 * Dua schedule dianggep satu cakupan kalo room-nya sama dan device-nya sama,
 * atau salah satunya berlaku buat satu room penuh.
 *
 * Dipake di: assertNoScheduleConflict (file ini).
 */
function scopeOverlap(a, b) {
  if (a.roomId !== b.roomId) return false;
  if (!a.deviceId || !b.deviceId) return true;
  return a.deviceId === b.deviceId;
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
    roomId: data.roomId,
    deviceId: data.deviceId || null,
    scheduledDate: data.scheduledDate,
    startTime: data.startTime,
    endTime: data.endTime || null,
    repeatType: data.repeatType || "none",
    repeatDays: data.repeatDays,
  };

  const conflict = candidates.find(
    (existing) =>
      scopeOverlap(target, existing) &&
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
 * Detail schedule plus room, device, sama pembuatnya (tanpa data sensitif).
 * Balikin null kalo nggak ketemu.
 *
 * Dipake di: schedule.controller.js → show (GET /api/schedules/:id).
 */
async function getScheduleById(id) {
  return prisma.schedule.findUnique({
    where: { id },
    include: {
      room: true,
      device: true,
      createdBy: { select: SAFE_USER_SELECT },
    },
  });
}

/**
 * Bikin schedule abis dicek nggak bentrok (deviceId/endTime kosong disimpen
 * null, repeatType default none), terus ngirim event schedule:created.
 *
 * Dipake di: schedule.controller.js → store (POST /api/schedules).
 */
async function createSchedule(data, userId) {
  const scheduledDate = new Date(data.scheduledDate);

  await assertNoScheduleConflict({ ...data, scheduledDate });

  const schedule = await prisma.schedule.create({
    data: {
      roomId: data.roomId,
      deviceId: data.deviceId || null,
      action: data.action,
      scheduledDate,
      startTime: data.startTime,
      endTime: data.endTime || null,
      repeatType: data.repeatType || "none",
      repeatDays: data.repeatDays || undefined,
      createdById: userId,
    },
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
  if (!existing) {
    const err = new Error("Schedule tidak ditemukan");
    err.status = 404;
    throw err;
  }

  const merged = {
    roomId: data.roomId ?? existing.roomId,
    deviceId: data.deviceId !== undefined ? data.deviceId : existing.deviceId,
    scheduledDate: data.scheduledDate
      ? new Date(data.scheduledDate)
      : existing.scheduledDate,
    startTime: data.startTime ?? existing.startTime,
    endTime: data.endTime !== undefined ? data.endTime : existing.endTime,
    repeatType: data.repeatType ?? existing.repeatType,
    repeatDays:
      data.repeatDays !== undefined ? data.repeatDays : existing.repeatDays,
  };

  await assertNoScheduleConflict(merged, id);

  const schedule = await prisma.schedule.update({
    where: { id },
    data: {
      roomId: data.roomId,
      deviceId: data.deviceId,
      action: data.action,
      scheduledDate: data.scheduledDate
        ? new Date(data.scheduledDate)
        : undefined,
      startTime: data.startTime,
      endTime: data.endTime,
      repeatType: data.repeatType,
      repeatDays: data.repeatDays,
      status: data.status,
    },
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
