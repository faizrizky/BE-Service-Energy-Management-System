const bcrypt = require("bcrypt");
const { prisma } = require("../../../frameworks/database/prismaClient");

/**
 * Buang passwordHash dari data user dan ringkes role jadi { id, name } sebelum
 * dikirim ke client.
 *
 * Dipake di: listUsersPaginated, listUsers, getUserById, createUser,
 *   updateUser, updateProfile (file ini).
 */
function sanitizeUser(user) {
  if (!user) return user;
  const { passwordHash, role, ...rest } = user;
  return {
    ...rest,
    role: role ? { id: role.id, name: role.name } : null,
  };
}

/**
 * List user pake paginasi, bisa filter role, search (nama, username, email,
 * alamat, role), sama tanggal.
 *
 * Dipake di: user.controller.js → index (GET /api/users).
 */
async function listUsersPaginated({
  page = 1,
  rowsPerPage = 10,
  search,
  roleId,
  createdFrom,
  createdTo,
} = {}) {
  const andConditions = [];

  if (roleId) {
    andConditions.push({
      roleId,
    });
  }

  if (search) {
    andConditions.push({
      OR: [
        { fullName: { contains: search, mode: "insensitive" } },
        { username: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { role: { name: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  if (createdFrom || createdTo) {
    const createdAt = {};
    if (createdFrom) createdAt.gte = new Date(createdFrom);
    if (createdTo) {
      const end = new Date(createdTo);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    andConditions.push({ createdAt });
  }

  const where = andConditions.length ? { AND: andConditions } : undefined;

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
    totalPages: Math.max(1, Math.ceil(totalRows / rowsPerPage)),
  };
}

/**
 * List semua user tanpa paginasi (udah dibersihin).
 *
 * Dipake di: Belom dipake di mana-mana.
 */
async function listUsers() {
  const users = await prisma.user.findMany({
    include: { role: true },
    orderBy: { createdAt: "desc" },
  });
  return users.map(sanitizeUser);
}

/**
 * Detail user (udah dibersihin). Balikin null kalo nggak ketemu.
 *
 * Dipake di: user.controller.js → show (GET /api/users/:id).
 */
async function getUserById(id) {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { role: true },
  });
  return sanitizeUser(user);
}

/**
 * Bikin user dengan password yang di-hash bcrypt. Kalo password nggak diisi,
 * pake password default "default123".
 *
 * Dipake di: user.controller.js → store (POST /api/users).
 */
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

/**
 * Ngedit user. Field password nggak disimpen mentah, tapi di-hash ke
 * passwordHash kalo diisi.
 *
 * Dipake di: user.controller.js → update (PUT /api/users/:id).
 */
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

/**
 * Hapus user berdasarkan id.
 *
 * Dipake di: user.controller.js → destroy (DELETE /api/users/:id).
 */
async function deleteUser(id) {
  return prisma.user.delete({ where: { id } });
}

/**
 * Ngedit profil sendiri, cuma fullName, phone, address, sama avatarUrl yang
 * boleh diubah.
 *
 * Dipake di: user.controller.js → updateMyProfile (PUT /api/users/me).
 */
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
