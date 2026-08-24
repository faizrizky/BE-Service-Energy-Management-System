jest.mock("../../../../src/frameworks/database/prismaClient", () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("bcrypt", () => ({ hash: jest.fn() }));

const bcrypt = require("bcrypt");
const { prisma } = require("../../../../src/frameworks/database/prismaClient");
const userUseCase = require("../../../../src/application/use_cases/user/user.usecase");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("createUser", () => {
  test("[negative] password kosong -> pakai default 'default123'", async () => {
    bcrypt.hash.mockResolvedValue("hashed-default");
    prisma.user.create.mockResolvedValue({ id: "u1" });

    await userUseCase.createUser({
      fullName: "Test",
      username: "test",
      email: "t@test.com",
      roleId: "r1",
    });

    expect(bcrypt.hash).toHaveBeenCalledWith("default123", 10);
  });

  test("password diisi -> di-hash pakai password itu", async () => {
    bcrypt.hash.mockResolvedValue("hashed-custom");
    prisma.user.create.mockResolvedValue({ id: "u1" });

    await userUseCase.createUser({
      fullName: "Test",
      username: "test",
      email: "t@test.com",
      roleId: "r1",
      password: "mypassword",
    });

    expect(bcrypt.hash).toHaveBeenCalledWith("mypassword", 10);
  });
});

describe("updateUser", () => {
  test("[negative] field 'password' plain text TIDAK ikut ke updateData (harus dihapus)", async () => {
    prisma.user.update.mockResolvedValue({ id: "u1" });

    await userUseCase.updateUser("u1", {
      fullName: "New Name",
      password: "should-not-leak",
    });

    const callArg = prisma.user.update.mock.calls[0][0];
    expect(callArg.data.password).toBeUndefined();
  });

  test("password diisi -> di-hash jadi passwordHash", async () => {
    bcrypt.hash.mockResolvedValue("new-hash");
    prisma.user.update.mockResolvedValue({ id: "u1" });

    await userUseCase.updateUser("u1", { password: "newpass" });

    const callArg = prisma.user.update.mock.calls[0][0];
    expect(callArg.data.passwordHash).toBe("new-hash");
  });

  test("password gak diisi -> passwordHash gak diubah sama sekali", async () => {
    prisma.user.update.mockResolvedValue({ id: "u1" });
    await userUseCase.updateUser("u1", { fullName: "New Name" });

    const callArg = prisma.user.update.mock.calls[0][0];
    expect(callArg.data.passwordHash).toBeUndefined();
    expect(bcrypt.hash).not.toHaveBeenCalled();
  });
});

describe("updateProfile", () => {
  test("cuma field profile yang boleh diupdate (fullName, phone, address, avatarUrl)", async () => {
    prisma.user.update.mockResolvedValue({ id: "u1" });

    await userUseCase.updateProfile("u1", {
      fullName: "New",
      phone: "0812",
      address: "Jakarta",
      avatarUrl: "http://x.com/a.png",
      roleId: "should-be-ignored",
    });

    const callArg = prisma.user.update.mock.calls[0][0];
    expect(callArg.data).toEqual({
      fullName: "New",
      phone: "0812",
      address: "Jakarta",
      avatarUrl: "http://x.com/a.png",
    });
    expect(callArg.data.roleId).toBeUndefined();
  });
});
