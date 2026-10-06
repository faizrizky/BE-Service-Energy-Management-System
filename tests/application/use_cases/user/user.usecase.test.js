jest.mock("bcrypt", () => ({ hash: jest.fn(async (value) => `hashed:${value}`) }));
jest.mock("../../../../src/frameworks/helpers/sessionRevocation", () => ({
  revokeSession: jest.fn().mockResolvedValue(undefined),
}));

const bcrypt = require("bcrypt");
const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const { revokeSession } = require("../../../../src/frameworks/helpers/sessionRevocation");
const userUseCase = require("../../../../src/application/use_cases/user/user.usecase");
const { resetPrismaMock } = require("../../../helpers/prisma");

const dbUser = (overrides = {}) => ({
  id: "u1",
  fullName: "Budi",
  username: "budi",
  email: "budi@test.com",
  passwordHash: "hashed:secret",
  roleId: "r1",
  role: { id: "r1", name: "Operator", description: "x", isSystem: false },
  ...overrides,
});

beforeEach(() => {
  resetPrismaMock(prisma);
  bcrypt.hash.mockClear();
});

describe("listUsersPaginated", () => {
  test("[positive] default page 1 / 10 baris, data disanitasi", async () => {
    prisma.user.count.mockResolvedValue(1);
    prisma.user.findMany.mockResolvedValue([dbUser()]);

    const result = await userUseCase.listUsersPaginated();

    expect(result).toEqual({
      data: [expect.not.objectContaining({ passwordHash: expect.anything() })],
      page: 1,
      rowsPerPage: 10,
      totalRows: 1,
      totalPages: 1,
    });
    expect(result.data[0].role).toEqual({ id: "r1", name: "Operator" });
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: undefined, skip: 0, take: 10 }));
  });

  test("[positive] filter roleId + search + rentang tanggal digabung dengan AND", async () => {
    prisma.user.count.mockResolvedValue(0);
    prisma.user.findMany.mockResolvedValue([]);

    await userUseCase.listUsersPaginated({
      roleId: "r1",
      search: "bud",
      createdFrom: "2026-09-01",
      createdTo: "2026-09-10",
      page: 3,
      rowsPerPage: 20,
    });

    const { where, skip, take } = prisma.user.findMany.mock.calls[0][0];
    expect(skip).toBe(40);
    expect(take).toBe(20);
    expect(where.AND[0]).toEqual({ roleId: "r1" });
    expect(where.AND[1].OR).toHaveLength(5);
    expect(where.AND[2].createdAt.gte).toEqual(new Date("2026-09-01"));
    expect(where.AND[2].createdAt.lte.getHours()).toBe(23);
    expect(prisma.user.count).toHaveBeenCalledWith({ where });
  });

  test("[positive] hanya createdTo -> tanpa batas bawah", async () => {
    prisma.user.count.mockResolvedValue(0);
    prisma.user.findMany.mockResolvedValue([]);
    await userUseCase.listUsersPaginated({ createdTo: "2026-09-10" });
    const { createdAt } = prisma.user.findMany.mock.calls[0][0].where.AND[0];
    expect(createdAt.gte).toBeUndefined();
    expect(createdAt.lte).toBeInstanceOf(Date);
  });

  test("[negative] totalRows 0 -> totalPages tetap 1, totalRows 21/10 -> 3", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    prisma.user.count.mockResolvedValue(0);
    expect((await userUseCase.listUsersPaginated()).totalPages).toBe(1);
    prisma.user.count.mockResolvedValue(21);
    expect((await userUseCase.listUsersPaginated()).totalPages).toBe(3);
  });
});

describe("getUserById", () => {
  test("[positive] disanitasi", async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser());
    const result = await userUseCase.getUserById("u1");
    expect(result.passwordHash).toBeUndefined();
    expect(result.username).toBe("budi");
  });

  test("[negative] tidak ditemukan -> null (bukan throw)", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(userUseCase.getUserById("x")).resolves.toBeNull();
  });

  test("[negative] user tanpa relasi role -> role null", async () => {
    prisma.user.findUnique.mockResolvedValue(dbUser({ role: null }));
    expect((await userUseCase.getUserById("u1")).role).toBeNull();
  });
});

describe("createUser", () => {
  const input = { fullName: "Budi", username: "budi", email: "b@test.com", roleId: "r1", password: "rahasia" };

  test("[positive] password di-hash (cost 10), hanya field yang diizinkan disimpan", async () => {
    prisma.user.create.mockResolvedValue(dbUser());
    const result = await userUseCase.createUser({ ...input, isAdmin: true, failedLoginCount: 99 });

    expect(bcrypt.hash).toHaveBeenCalledWith("rahasia", 10);
    const { data } = prisma.user.create.mock.calls[0][0];
    expect(data).toEqual({
      fullName: "Budi",
      username: "budi",
      email: "b@test.com",
      phone: undefined,
      address: undefined,
      passwordHash: "hashed:rahasia",
      roleId: "r1",
    });
    expect(result.passwordHash).toBeUndefined();
  });

  test("[negative] tanpa password -> memakai password default 'default123' (risiko keamanan, lihat laporan review)", async () => {
    prisma.user.create.mockResolvedValue(dbUser());
    await userUseCase.createUser({ ...input, password: undefined });
    expect(bcrypt.hash).toHaveBeenCalledWith("default123", 10);
  });

  test("[negative] username/email duplikat (P2002) diteruskan", async () => {
    prisma.user.create.mockRejectedValue(Object.assign(new Error("Unique"), { code: "P2002" }));
    await expect(userUseCase.createUser(input)).rejects.toMatchObject({ code: "P2002" });
  });
});

describe("updateUser", () => {
  test("[positive] password baru di-hash & field plain 'password' tidak ikut disimpan", async () => {
    prisma.user.update.mockResolvedValue(dbUser());
    await userUseCase.updateUser("u1", { fullName: "Budi B", password: "barubaru" });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "u1" },
      data: { fullName: "Budi B", passwordHash: "hashed:barubaru" },
      include: { role: true },
    });
  });

  test("[positive] tanpa password -> passwordHash tidak diubah", async () => {
    prisma.user.update.mockResolvedValue(dbUser());
    await userUseCase.updateUser("u1", { email: "baru@test.com" });
    const { data } = prisma.user.update.mock.calls[0][0];
    expect(data).toEqual({ email: "baru@test.com" });
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });

  test("[negative] password string kosong -> diabaikan (tidak meng-hash string kosong)", async () => {
    prisma.user.update.mockResolvedValue(dbUser());
    await userUseCase.updateUser("u1", { password: "" });
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({});
  });

  test("[negative] user tidak ada (P2025) diteruskan ke pemanggil", async () => {
    prisma.user.update.mockRejectedValue(Object.assign(new Error("Record not found"), { code: "P2025" }));
    await expect(userUseCase.updateUser("x", { fullName: "a" })).rejects.toMatchObject({ code: "P2025" });
  });
});

describe("deleteUser", () => {
  const target = (overrides = {}) => ({
    ...dbUser({ id: "u2", fullName: "Sari" }),
    _count: { schedules: 0 },
    refreshTokens: [{ id: "rt1" }, { id: "rt2" }],
    ...overrides,
  });

  beforeEach(() => revokeSession.mockClear());

  test("[positive] user yang pernah login -> relasi dilepas, user dihapus dalam satu transaksi (TS-110)", async () => {
    prisma.user.findUnique.mockResolvedValue(target());
    await userUseCase.deleteUser("u2", "admin1");

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: "u2" } });
    expect(prisma.commandLog.updateMany).toHaveBeenCalledWith({
      where: { triggeredByUserId: "u2" },
      data: { triggeredByUserId: null },
    });
    expect(prisma.gateway.updateMany).toHaveBeenCalledWith({ where: { installedById: "u2" }, data: { installedById: null } });
    expect(prisma.room.updateMany).toHaveBeenCalledWith({ where: { picUserId: "u2" }, data: { picUserId: null } });
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: "u2" } });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test("[positive] semua sesi login user dicabut -> access token-nya langsung nggak berlaku", async () => {
    prisma.user.findUnique.mockResolvedValue(target());
    await userUseCase.deleteUser("u2", "admin1");
    expect(revokeSession.mock.calls).toEqual([["rt1"], ["rt2"]]);
  });

  test("[negative] hapus akun sendiri -> 400 tanpa query DB", async () => {
    await expect(userUseCase.deleteUser("admin1", "admin1")).rejects.toMatchObject({
      status: 400,
      message: "Tidak bisa menghapus akun sendiri",
    });
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  test("[negative] user masih pembuat schedule -> 409 pesan jelas, nggak ada yang dihapus", async () => {
    prisma.user.findUnique.mockResolvedValue(target({ _count: { schedules: 3 } }));
    await expect(userUseCase.deleteUser("u2", "admin1")).rejects.toMatchObject({
      status: 409,
      message: 'User "Sari" masih tercatat sebagai pembuat 3 schedule, hapus atau ubah schedule-nya dulu',
    });
    expect(prisma.user.delete).not.toHaveBeenCalled();
    expect(revokeSession).not.toHaveBeenCalled();
  });

  test("[negative] user nggak ada -> 404", async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(userUseCase.deleteUser("x", "admin1")).rejects.toMatchObject({ status: 404, message: "User tidak ditemukan" });
  });
});


describe("updateProfile", () => {
  test("[positive] hanya fullName, phone, address, avatarUrl yang bisa diubah", async () => {
    prisma.user.update.mockResolvedValue(dbUser());
    await userUseCase.updateProfile("u1", {
      fullName: "Budi",
      phone: "0812",
      address: "Bandung",
      avatarUrl: "https://a.test/x.png",
      roleId: "admin-role",
      passwordHash: "hack",
      username: "root",
    });
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({
      fullName: "Budi",
      phone: "0812",
      address: "Bandung",
      avatarUrl: "https://a.test/x.png",
    });
  });

  test("[negative] body kosong -> semua field undefined (Prisma tidak mengubah apa pun)", async () => {
    prisma.user.update.mockResolvedValue(dbUser());
    await userUseCase.updateProfile("u1", {});
    expect(prisma.user.update.mock.calls[0][0].data).toEqual({
      fullName: undefined,
      phone: undefined,
      address: undefined,
      avatarUrl: undefined,
    });
  });
});
