const { prisma } = require("../../../frameworks/database/prismaClient");
const { sendRelayCommand } = require("../../../frameworks/thingsboard/client");

async function listDevices(filter = {}) {
  return prisma.device.findMany({
    where: {
      roomId: filter.roomId || undefined,
      gatewayId: filter.gatewayId || undefined,
    },
    include: { room: true, gateway: true },
    orderBy: { createdAt: "desc" },
  });
}

async function getDeviceById(id) {
  return prisma.device.findUnique({
    where: { id },
    include: { room: true, gateway: true },
  });
}

async function createDevice(data) {
  return prisma.device.create({
    data: {
      eui: data.eui,
      tbDeviceId: data.tbDeviceId || null,
      name: data.name,
      deviceType: data.deviceType,
      intervalMinutes: data.intervalMinutes || 5,
      roomId: data.roomId,
      gatewayId: data.gatewayId,
    },
  });
}

async function updateDevice(id, data) {
  return prisma.device.update({
    where: { id },
    data: {
      name: data.name,
      tbDeviceId: data.tbDeviceId,
      deviceType: data.deviceType,
      intervalMinutes: data.intervalMinutes,
      roomId: data.roomId,
      gatewayId: data.gatewayId,
    },
  });
}

async function deleteDevice(id) {
  return prisma.$transaction(async (tx) => {
    const device = await tx.device.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!device) {
      const err = new Error("Device tidak ditemukan");
      err.status = 404;
      throw err;
    }

    await tx.energyReading.deleteMany({
      where: { deviceId: id },
    });

    await tx.commandLog.updateMany({
      where: { deviceId: id },
      data: { deviceId: null },
    });

    await tx.schedule.updateMany({
      where: { deviceId: id },
      data: { deviceId: null },
    });

    return tx.device.delete({
      where: { id },
    });
  });
}

async function powerDevice(deviceId, action, options = {}) {
  const { userId = null, scheduleId = null } = options;
  const triggerType = scheduleId ? "scheduled" : "manual";

  const device = await prisma.device.findUnique({ where: { id: deviceId } });

  if (!device) {
    const err = new Error("Device tidak ditemukan");
    err.status = 404;
    throw err;
  }

  if (!device.tbDeviceId) {
    const err = new Error(
      "Device belum terhubung ke ThingsBoard (tbDeviceId kosong)",
    );
    err.status = 409;
    throw err;
  }

  let status = "success";
  let notes = null;

  try {
    await sendRelayCommand(device.tbDeviceId, action);
  } catch (err) {
    status = "failed";
    notes = err.message;
  }

  await prisma.commandLog.create({
    data: {
      roomId: device.roomId,
      deviceId: device.id,
      action,
      triggerType,
      triggeredByUserId: userId,
      scheduleId,
      status,
      notes,
    },
  });

  if (status === "success") {
    await prisma.device.update({
      where: { id: deviceId },
      data: { status: action },
    });
  }

  return { deviceId, action, status, notes };
}

module.exports = {
  listDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  powerDevice,
};
