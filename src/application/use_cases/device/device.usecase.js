const { prisma } = ("../../../frameworks/database/prismaClient");
const { publishDeviceCommand } = require('../../../frameworks/mqtt/publisher');

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

async function powerDevice(deviceId, action, userId) {
    const device = await prisma.device.findUnique({
        where: {id: gatewayId},
        include: {gateway: true}
    })

    if(!device){
        const err = new Error ('Device tidak ditemukan')
        err.status = 404
        throw err
    }

    let status = 'success'
    let notes = null

    try {
        await publishDeviceCommand(device.gateway.eui, device.eui, action)
    } catch (err) {
        status = 'failed'
        notes = err.message
    }

    await prisma.commandLog.create({
        data: {
            roomId: device.roomId,
            deviceId: device.id,
            action,
            triggerType: 'manual',
            triggeredByUserId: userId,
            status,
            notes,
        },
    })

    if(status === 'success') await prisma.device.update({where: {id: deviceId}, data:{status:action}})

    return {deviceId, action, status, notes}
}

module.exports = {
  listDevices,
  getDeviceById,
  createDevice,
  updateDevice,
  deleteDevice,
  powerDevice
};