const { prisma } = ("../../../frameworks/database/prismaClient");

async function listDevices(filter = {}) {
    return prisma.device.findMany({
        where: {
            roomId: filter.roomId || undefined,
            gatewayId: filter.gatewayId || undefined,
        },
        include: {room: true, gateway: true},
        orderBy: {createdAt: 'desc'}
    })
}

async function getDeviceById(id) {
    return prisma.device.findUnique({
        where: {id},
        include: {room: true, gateway: true}
    })
}

async function createDevice(data) {
    return prisma.device.create({
        data:{
            eui: data.eui,
            name: data.name,
            deviceType: data.deviceType,
            intervalMinutes: data.intervalMinutes || 5,
            roomId: data.roomId,
            gatewayId: data.gatewayId,
        }
    })
}

async function updateDevice(id, data) {
    return prisma.device.update({
    where: { id },
    data: {
      name: data.name,
      deviceType: data.deviceType,
      intervalMinutes: data.intervalMinutes,
      roomId: data.roomId,
      gatewayId: data.gatewayId,
        },
    })
}

async function deleteDevice(id) {
  return prisma.device.delete({ where: { id } });
}

module.exports = {
  listDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
};