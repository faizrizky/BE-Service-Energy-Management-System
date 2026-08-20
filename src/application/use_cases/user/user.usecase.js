const bcrypt = require('bcrypt');
const { prisma } = require('../../../frameworks/database/prismaClient');

async function listUsers() {
  return prisma.user.findMany({
    include: { role: true },
    orderBy: { createdAt: 'desc' },
  });
}

async function getUserById(id) {
  return prisma.user.findUnique({ where: { id }, include: { role: true } });
}

async function createUser(data) {
  const passwordHash = await bcrypt.hash(data.password || 'default123', 10);

  return prisma.user.create({
    data: {
      fullName: data.fullName,
      username: data.username,
      email: data.email,
      phone: data.phone,
      address: data.address,
      passwordHash,
      roleId: data.roleId,
    },
  });
}

async function updateUser(id, data) {
  const updateData = { ...data };
  delete updateData.password;

  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }

  return prisma.user.update({ where: { id }, data: updateData });
}

async function deleteUser(id) {
  return prisma.user.delete({ where: { id } });
}

async function updateProfile(id, data) {
  const { fullName, phone, address, avatarUrl } = data;
  return prisma.user.update({
    where: { id },
    data: { fullName, phone, address, avatarUrl },
  });
}

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateProfile,
};