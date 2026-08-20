const { prisma } = ("../../../frameworks/database/prismaClient");

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

async function updateRoom(params) {
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

module.exports = {
  listRooms,
  getRoomById,
  createRoom,
  updateRoom,
  deleteRoom,
  listDevicesInRoom,
};