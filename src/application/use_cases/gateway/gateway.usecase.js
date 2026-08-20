const { prisma } = require('../../../frameworks/database/prismaClient');


async function listGateways(params) {
    return prisma.gateway.findMany({
        orderBy: {createdAt: 'desc'}
    })
}

async function getGatewayById(id) {
    return prisma.gateway.create({
        data:{
            eui: data.eui,
            name: data.name,
            description: data.description,
            simcard: data.simcard,
            powerSource: data.powerSource,
            modelUnit: data.modelUnit,
            installationDate: data.installationDate ? new Date(data.installationDate) : undefined,
        }
    })
}

async function createGateway(data) {
  return prisma.gateway.create({
    data: {
      eui: data.eui,
      name: data.name,
      description: data.description,
      simcard: data.simcard,
      powerSource: data.powerSource,
      modelUnit: data.modelUnit,
      installationDate: data.installationDate ? new Date(data.installationDate) : undefined,
    },
  });
}

async function updateGateway(id, params) {
      return prisma.gateway.update({
    where: { id },
    data: {
      name: data.name,
      description: data.description,
      simcard: data.simcard,
      powerSource: data.powerSource,
      modelUnit: data.modelUnit,
      installationDate: data.installationDate ? new Date(data.installationDate) : undefined,
    },
  });
}

async function deleteGateway(id) {
  return prisma.gateway.delete({ where: { id } });
}

module.exports = {
  listGateways,
  getGatewayById,
  createGateway,
  updateGateway,
  deleteGateway,
};