const { prisma } = require("../../../frameworks/database/prismaClient");
const {
  timeRangesOverlap,
  occurrenceDatesOverlap,
} = require("./schedule-time.util");

const SAFE_USER_SELECT = {
  id: true,
  fullName: true,
  username: true,
  email: true,
};

async function listSchedulesPaginated(filter = {}) {
  const { roomId, page = 1, rowsPerPage = 10, search } = filter;

  const where = {
    ...(roomId ? { roomId } : {}),
    ...(search
      ? {
          OR: [
            { room: { name: { contains: search, mode: "insensitive" } } },
            { device: { name: { contains: search, mode: "insensitive" } } },
            { device: { eui: { contains: search, mode: "insensitive" } } },
            {
              device: { deviceType: { contains: search, mode: "insensitive" } },
            },
          ],
        }
      : {}),
  };

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

function scopeOverlap(a, b) {
  if (a.roomId !== b.roomId) return false;
  if (!a.deviceId || !b.deviceId) return true;
  return a.deviceId === b.deviceId;
}

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

async function createSchedule(data, userId) {
  const scheduledDate = new Date(data.scheduledDate);

  await assertNoScheduleConflict({ ...data, scheduledDate });

  return prisma.schedule.create({
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
}

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

  return prisma.schedule.update({
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
}

async function deleteSchedule(id) {
  return prisma.schedule.delete({ where: { id } });
}

module.exports = {
  listSchedulesPaginated,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
};
