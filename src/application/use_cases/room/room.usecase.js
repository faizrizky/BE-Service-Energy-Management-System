const { prisma } = require("../../../frameworks/database/prismaClient");
const { publishDeviceCommand } = require('../../../frameworks/mqtt/publisher');

async function listRooms() {
    return prisma.room.findMany({
        include: {devices: true},
        orderBy: {createdAt: 'desc'}
    })
}

async function getRoomById(id) {
    return prisma.room.findUnique({
        where: {id},
        include: {devices:{include:{gateway:true}}}
    })
}

async function createRoom(data) {
    return prisma.room.create({
        data:{
            name: data.name,
            picName: data.picName,
            picPhone: data.picPhone,
            location: data.location,
            description: data.description,
            imageUrl: data.imageUrl,
            isCritical: data.isCritical || false,
        }
    })
}

async function updateRoom(id, data) {
  return prisma.room.update({
    where: { id },
    data: {
      name: data.name,
      picName: data.picName,
      picPhone: data.picPhone,
      location: data.location,
      description: data.description,
      imageUrl: data.imageUrl,
      isCritical: data.isCritical,
    },
  });
}

async function deleteRoom(id) {
  return prisma.room.delete({ where: { id } });
}

async function listDevicesInRoom(roomId) {
  return prisma.device.findMany({
    where: { roomId },
    include: { gateway: true },
  });
}

async function powerRoom(roomId, action, userId) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: { devices: { include: { gateway: true } } },
  });

  if (!room) {
    const err = new Error('Room tidak ditemukan');
    err.status = 404;
    throw err;
  }

  const results = [];

  for (const device of room.devices) {
    let status = 'success';
    let notes = null;

    try {
      await publishDeviceCommand(device.gateway.eui, device.eui, action);
    } catch (err) {
      status = 'failed';
      notes = err.message;
    }

    await prisma.commandLog.create({
      data: {
        roomId: room.id,
        deviceId: device.id,
        action,
        triggerType: 'manual',
        triggeredByUserId: userId,
        status,
        notes,
      },
    });

    if (status === 'success') {
      await prisma.device.update({ where: { id: device.id }, data: { status: action } });
    }

    results.push({ deviceId: device.id, status, notes });
  }

  return { roomId, action, results };
}

module.exports = {
  listRooms, getRoomById, createRoom, updateRoom, deleteRoom, listDevicesInRoom,
  powerRoom,
};