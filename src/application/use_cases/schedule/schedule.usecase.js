const { prisma } = require('../../../frameworks/database/prismaClient');

async function listSchedules(filter = {}) {
  return prisma.schedule.findMany({
    where: {
      roomId: filter.roomId || undefined,
    },
    include: { room: true, device: true, createdBy: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function getScheduleById(id) {
  return prisma.schedule.findUnique({
    where: { id },
    include: { room: true, device: true, createdBy: true },
  });
}

async function createSchedule(data, userId) {
  return prisma.schedule.create({
    data: {
      roomId: data.roomId,
      deviceId: data.deviceId || null,
      action: data.action,
      scheduledDate: new Date(data.scheduledDate),
      startTime: data.startTime,
      endTime: data.endTime || null,
      repeatType: data.repeatType || 'none',
      repeatDays: data.repeatDays || undefined,
      createdById: userId,
    },
  });
}

async function updateSchedule(id, data) {
  return prisma.schedule.update({
    where: { id },
    data: {
      roomId: data.roomId,
      deviceId: data.deviceId,
      action: data.action,
      scheduledDate: data.scheduledDate ? new Date(data.scheduledDate) : undefined,
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
  listSchedules,
  getScheduleById,
  createSchedule,
  updateSchedule,
  deleteSchedule,
};