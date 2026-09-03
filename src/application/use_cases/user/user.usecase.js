const bcrypt = require("bcrypt");
const { prisma } = require("../../../frameworks/database/prismaClient");

function sanitizeUser(user) {
  if (!user) return user;
  const { passwordHash, role, ...rest } = user;
  return {
    ...rest,
    role: role ? { id: role.id, name: role.name } : null,
  };
}

async function listUsersPaginated({
  page = 1,
  rowsPerPage = 10,
  search,
  roleId,
} = {}) {
  const where = {
    ...(roleId ? { roleId } : {}),
    ...(search
      ? {
          OR: [
            {
              fullName: {
                contains: search,
                mode: "insensitive",
              },
            },
            {
              address: {
                contains: search,
                mode: "insensitive",
              },
            },
            { role: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [totalRows, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      include: { role: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * rowsPerPage,
      take: rowsPerPage,
    }),
  ]);

  return {
    data: users.map(sanitizeUser),
    page,
    rowsPerPage,
    totalRows,
    totalPage: Math.max(1, Math.ceil(totalRows / rowsPerPage)),
  };
}

async function listUsers() {
  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });
  return users.map(sanitizeUser);
}

async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
  return sanitizeUser(user);
}

async function createUser(data) {
  const passwordHash = await bcrypt.hash(data.password || "default123", 10);

  const user = await prisma.user.create({
    data: {
      fullName: data.fullName,
      username: data.username,
      email: data.email,
      phone: data.phone,
      address: data.address,
      passwordHash,
      roleId: data.roleId,
    },
    include: { role: true },
  });

  return sanitizeUser(user);
}

async function updateUser(id, data) {
  const updateData = { ...data };
  delete updateData.password;

  if (data.password) {
    updateData.passwordHash = await bcrypt.hash(data.password, 10);
  }

  const user = await prisma.user.update({
    where: { id },
    data: updateData,
    include: { role: true },
  });

  return sanitizeUser(user);
}

async function deleteUser(id) {
  return prisma.user.delete({ where: { id } });
}

async function updateProfile(id, data) {
  const { fullName, phone, address, avatarUrl } = data;
  const user = await prisma.user.update({
    where: { id },
    data: { fullName, phone, address, avatarUrl },
    include: { role: true },
  });
  return sanitizeUser(user);
}

module.exports = {
  listUsersPaginated,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
  updateProfile,
};
