const { loginSchema, refreshSchema } = require("../../../src/application/validators/auth.validator");
const {
  createDeviceSchema,
  updateDeviceSchema,
  powerActionSchema,
  telemetryPingSchema,
  intervalSchema,
} = require("../../../src/application/validators/device.validator");
const {
  createGatewaySchema,
  updateGatewaySchema,
} = require("../../../src/application/validators/gateway.validator");
const { createRoleSchema, updateRoleSchema } = require("../../../src/application/validators/role.validator");
const {
  createRoomSchema,
  updateRoomSchema,
  powerActionSchema: roomPowerActionSchema,
} = require("../../../src/application/validators/room.validator");
const {
  scheduleSchema,
  updateScheduleSchema,
} = require("../../../src/application/validators/schedule.validator");
const {
  createUserSchema,
  updateUserSchema,
  updateProfileSchema,
} = require("../../../src/application/validators/user.validator");

const UUID = "3f1c2a9e-8b7d-4c6e-9a1b-2d3e4f5a6b7c";
const UUID_2 = "7a2b3c4d-5e6f-4a1b-8c2d-3e4f5a6b7c8d";

function messages(schema, input) {
  const result = schema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

function ok(schema, input) {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(JSON.stringify(result.error.issues));
  return result.data;
}

function fails(schema, input) {
  expect(schema.safeParse(input).success).toBe(false);
}

describe("auth.validator", () => {
  test("[positive] login dengan username/password (+captcha opsional)", () => {
    expect(ok(loginSchema, { username: "admin", password: "x" })).toEqual({
      username: "admin",
      password: "x",
    });
    expect(ok(loginSchema, { username: "a", password: "b", captchaToken: "t" }).captchaToken).toBe("t");
  });

  test("[negative] username/password kosong -> pesan wajib diisi", () => {
    expect(messages(loginSchema, { username: "", password: "" })).toEqual([
      "Username wajib diisi",
      "Password wajib diisi",
    ]);
  });

  test("[negative] field hilang, bukan string, atau terlalu panjang", () => {
    fails(loginSchema, {});
    fails(loginSchema, { username: 123, password: "x" });
    fails(loginSchema, { username: "a".repeat(101), password: "x" });
    fails(loginSchema, { username: "a", password: "x".repeat(101) });
    fails(loginSchema, { username: "a", password: "x", captchaToken: 1 });
  });

  test("[positive] refresh token minimal 20 karakter", () => {
    ok(refreshSchema, { refreshToken: "a".repeat(20) });
  });

  test("[negative] refresh token < 20 karakter / tidak ada", () => {
    expect(messages(refreshSchema, { refreshToken: "short" })).toEqual(["Refresh Token tidak valid"]);
    fails(refreshSchema, {});
  });
});

describe("device.validator", () => {
  const valid = {
    // eui device = devEUI ChirpStack (16 hex), nggak ada lagi ThingsBoard device ID.
    eui: "08000000410000e4",
    name: "AC Ruang Server",
    roomId: UUID,
    gatewayId: UUID_2,
  };

  test("[positive] create minimal (field opsional tidak diisi)", () => {
    expect(ok(createDeviceSchema, valid)).toEqual(valid);
  });

  test("[positive] eui 16 hex, huruf besar/kecil sama-sama boleh", () => {
    ok(createDeviceSchema, { ...valid, eui: "08000000410000e4" });
    ok(createDeviceSchema, { ...valid, eui: "08000000410000E4" });
  });

  test("[negative] eui bukan devEUI 16 hex", () => {
    fails(createDeviceSchema, { ...valid, eui: "DEV-001" });
    fails(createDeviceSchema, { ...valid, eui: "0800000041" });
    fails(createDeviceSchema, { ...valid, eui: "zz000000410000e4" });
    fails(createDeviceSchema, { ...valid, eui: "08000000410000e4ff" });
  });

  test("[positive] intervalMinutes di-coerce dari string & batas 15..1440 inklusif", () => {
    expect(ok(createDeviceSchema, { ...valid, intervalMinutes: "15" }).intervalMinutes).toBe(15);
    expect(ok(createDeviceSchema, { ...valid, intervalMinutes: 1440 }).intervalMinutes).toBe(1440);
  });

  test("[negative] intervalMinutes di luar batas / pecahan", () => {
    expect(messages(createDeviceSchema, { ...valid, intervalMinutes: 14 })).toEqual([
      "Interval minutes minimal 15",
    ]);
    fails(createDeviceSchema, { ...valid, intervalMinutes: 1441 });
    fails(createDeviceSchema, { ...valid, intervalMinutes: 15.5 });
    fails(createDeviceSchema, { ...valid, intervalMinutes: "abc" });
  });

  test("[negative] field wajib kosong & roomId/gatewayId bukan UUID", () => {
    expect(messages(createDeviceSchema, { ...valid, eui: "", name: "" })).toEqual([
      "eui harus devEUI ChirpStack (16 karakter hex)",
      "name wajib diisi",
    ]);
    expect(messages(createDeviceSchema, { ...valid, roomId: "room-1" })).toEqual(["Room Id tidak valid"]);
    expect(messages(createDeviceSchema, { ...valid, gatewayId: "gw" })).toEqual(["Gateway Id tidak valid"]);
  });

  test("[negative] name > 120 / deviceType > 50 karakter", () => {
    fails(createDeviceSchema, { ...valid, name: "a".repeat(121) });
    fails(createDeviceSchema, { ...valid, deviceType: "a".repeat(51) });
  });

  test("[positive] update partial: body kosong valid, field yang dikirim tetap divalidasi", () => {
    expect(ok(updateDeviceSchema, {})).toEqual({});
    ok(updateDeviceSchema, { name: "Baru" });
    fails(updateDeviceSchema, { roomId: "bukan-uuid" });
  });

  test("[positive/negative] power action hanya 'on' atau 'off'", () => {
    ok(powerActionSchema, { action: "on" });
    ok(powerActionSchema, { action: "off" });
    expect(messages(powerActionSchema, { action: "toggle" })).toEqual(['action harus "on" atau "off"']);
    fails(powerActionSchema, { action: "ON" });
    fails(powerActionSchema, {});
  });

  test("[positive] telemetry ping timeout opsional, batas 5000..300000", () => {
    expect(ok(telemetryPingSchema, {})).toEqual({});
    expect(ok(telemetryPingSchema, { timeout: "5000" }).timeout).toBe(5000);
    ok(telemetryPingSchema, { timeout: 300000 });
  });

  test("[negative] telemetry ping timeout di luar batas", () => {
    expect(messages(telemetryPingSchema, { timeout: 4999 })).toEqual(["timeout minimal 5000 ms"]);
    expect(messages(telemetryPingSchema, { timeout: 300001 })).toEqual(["timeout maksimal 300000 ms"]);
  });

  test("[positive/negative] interval wajib diisi, 15..1440", () => {
    expect(ok(intervalSchema, { intervalMinutes: "30" })).toEqual({ intervalMinutes: 30 });
    expect(messages(intervalSchema, { intervalMinutes: 1500 })).toEqual(["Interval minutes maksimal 1440"]);
    fails(intervalSchema, {});
  });
});

describe("gateway.validator", () => {
  const valid = { eui: "7276ff0045060ffb", name: "Kerlink" };

  test("[positive] create minimal & semua field opsional terisi", () => {
    ok(createGatewaySchema, valid);
    ok(createGatewaySchema, {
      ...valid,
      description: "Lantai 1",
      simcard: "0812",
      powerSource: "PLN",
      modelUnit: "iStation",
      installationDate: "2026-09-01",
      installedById: UUID,
    });
  });

  test("[positive] installationDate format YYYY-MM-DD, ISO datetime (+offset), atau kosong", () => {
    ok(createGatewaySchema, { ...valid, installationDate: "2026-09-01" });
    ok(createGatewaySchema, { ...valid, installationDate: "2026-09-01T10:00:00Z" });
    ok(createGatewaySchema, { ...valid, installationDate: "2026-09-01T10:00:00+07:00" });
    ok(createGatewaySchema, { ...valid, installationDate: "" });
  });

  test("[negative] installationDate format lain", () => {
    fails(createGatewaySchema, { ...valid, installationDate: "01-09-2026" });
    fails(createGatewaySchema, { ...valid, installationDate: "kemarin" });
  });

  test("[negative] eui/name kosong, installedById bukan UUID, field kepanjangan", () => {
    expect(messages(createGatewaySchema, { eui: "", name: "" })).toEqual([
      "eui wajib diisi",
      "Name gateway wajib diisi",
    ]);
    fails(createGatewaySchema, { ...valid, installedById: "user-1" });
    fails(createGatewaySchema, { ...valid, description: "a".repeat(501) });
    fails(createGatewaySchema, { ...valid, simcard: "1".repeat(51) });
  });

  test("[positive] update partial", () => {
    ok(updateGatewaySchema, {});
    ok(updateGatewaySchema, { installedById: "" });
  });
});

describe("role.validator", () => {
  test("[positive] nama + deskripsi + permissionIds UUID", () => {
    ok(createRoleSchema, { name: "Operator", description: "", permissionIds: [UUID, UUID_2] });
    ok(createRoleSchema, { name: "Operator" });
    ok(updateRoleSchema, {});
  });

  test("[negative] nama kosong, permissionIds bukan array UUID", () => {
    expect(messages(createRoleSchema, { name: "" })).toEqual(["Role name wajib diisi"]);
    fails(createRoleSchema, { name: "Op", permissionIds: ["perm-1"] });
    fails(createRoleSchema, { name: "Op", permissionIds: UUID });
    fails(createRoleSchema, { name: "a".repeat(81) });
  });
});

describe("room.validator", () => {
  test("[positive] create lengkap & minimal", () => {
    ok(createRoomSchema, { name: "Server Room" });
    ok(createRoomSchema, {
      name: "Server Room",
      picName: "Budi",
      picPhone: "0812",
      location: "Lt 2",
      description: "",
      imageUrl: "https://cdn.test/room.png",
      isCritical: true,
    });
    ok(updateRoomSchema, {});
  });

  test("[negative] name kosong, imageUrl bukan URL, isCritical bukan boolean", () => {
    expect(messages(createRoomSchema, { name: "" })).toEqual(["name wajib diisi"]);
    expect(messages(createRoomSchema, { name: "R", imageUrl: "room.png" })).toEqual([
      "Image Url harus URL valid",
    ]);
    fails(createRoomSchema, { name: "R", isCritical: "true" });
    fails(createRoomSchema, { name: "R", picPhone: "1".repeat(31) });
  });

  test("[positive/negative] power action ruangan", () => {
    ok(roomPowerActionSchema, { action: "off" });
    fails(roomPowerActionSchema, { action: "restart" });
  });
});

describe("schedule.validator", () => {
  const valid = {
    roomId: UUID,
    action: "on",
    scheduledDate: "2026-09-20",
    startTime: "08:00",
  };

  test("[positive] schedule minimal & lengkap (weekly)", () => {
    ok(scheduleSchema, valid);
    ok(scheduleSchema, {
      ...valid,
      deviceId: UUID_2,
      endTime: "17:00",
      repeatType: "weekly",
      repeatDays: [1, 3, 5],
      status: "active",
    });
  });

  test("[positive] deviceId & endTime boleh null atau string kosong", () => {
    ok(scheduleSchema, { ...valid, deviceId: null, endTime: null });
    ok(scheduleSchema, { ...valid, deviceId: "", endTime: "" });
  });

  test("[positive] batas jam 00:00 dan 23:59", () => {
    ok(scheduleSchema, { ...valid, startTime: "00:00", endTime: "23:59" });
  });

  test("[negative] format jam salah", () => {
    expect(messages(scheduleSchema, { ...valid, startTime: "24:00" })).toEqual([
      "Format startTime harus HH:mm",
    ]);
    fails(scheduleSchema, { ...valid, startTime: "8:00" });
    fails(scheduleSchema, { ...valid, startTime: "08:60" });
    expect(messages(scheduleSchema, { ...valid, endTime: "5pm" })).toEqual(["Format endTime harus HH:mm"]);
  });

  test("[negative] format tanggal salah / roomId bukan UUID / enum tidak dikenal", () => {
    expect(messages(scheduleSchema, { ...valid, scheduledDate: "20-09-2026" })).toEqual([
      "Format scheduledDate harus YYYY-MM-DD",
    ]);
    expect(messages(scheduleSchema, { ...valid, roomId: "r1" })).toEqual(["roomId tidak valid"]);
    fails(scheduleSchema, { ...valid, action: "toggle" });
    fails(scheduleSchema, { ...valid, repeatType: "monthly" });
    fails(scheduleSchema, { ...valid, status: "paused" });
  });

  test("[negative] repeatDays di luar 0..6 atau bukan integer", () => {
    fails(scheduleSchema, { ...valid, repeatDays: [7] });
    fails(scheduleSchema, { ...valid, repeatDays: [-1] });
    fails(scheduleSchema, { ...valid, repeatDays: [1.5] });
  });

  // Celah validasi: backend menerima kombinasi yang tidak pernah bisa dieksekusi.
  test.failing("[BUG] repeatType 'weekly' tanpa repeatDays seharusnya ditolak", () => {
    fails(scheduleSchema, { ...valid, repeatType: "weekly" });
  });

  test.failing("[BUG] tanggal kalender mustahil (2026-02-30) seharusnya ditolak", () => {
    fails(scheduleSchema, { ...valid, scheduledDate: "2026-02-30" });
  });

  test("[positive] update partial", () => {
    ok(updateScheduleSchema, {});
    ok(updateScheduleSchema, { status: "completed" });
  });
});

describe("user.validator", () => {
  const valid = {
    fullName: "Budi Santoso",
    username: "budi.s",
    email: "budi@test.com",
    roleId: UUID,
  };

  test("[positive] create minimal & lengkap", () => {
    ok(createUserSchema, valid);
    ok(createUserSchema, {
      ...valid,
      phone: "+62 (812) 3456-789",
      address: "Jakarta",
      password: "rahasia",
    });
    ok(createUserSchema, { ...valid, phone: "" });
  });

  test("[negative] username terlalu pendek atau karakter tidak diizinkan", () => {
    expect(messages(createUserSchema, { ...valid, username: "bu" })).toEqual([
      "Username minimal 3 karakter",
    ]);
    expect(messages(createUserSchema, { ...valid, username: "budi santoso" })).toEqual([
      "username hanya boleh huruf, angka, titik, underscore, dash",
    ]);
    fails(createUserSchema, { ...valid, username: "budi<script>" });
  });

  test("[negative] email tidak valid / kepanjangan", () => {
    expect(messages(createUserSchema, { ...valid, email: "budi@" })).toEqual([
      "Format email tidak valid",
    ]);
    fails(createUserSchema, { ...valid, email: `${"a".repeat(45)}@test.com` });
  });

  test("[negative] phone format salah / roleId bukan UUID / password < 6", () => {
    expect(messages(createUserSchema, { ...valid, phone: "08abc" })).toEqual([
      "format nomor telepon tidak valid",
    ]);
    expect(messages(createUserSchema, { ...valid, roleId: "admin" })).toEqual(["Roleid tidak valid"]);
    expect(messages(createUserSchema, { ...valid, password: "12345" })).toEqual([
      "Password minimal 6 karakter",
    ]);
  });

  test("[positive] update partial & update profile", () => {
    ok(updateUserSchema, {});
    ok(updateUserSchema, { password: "barubaru" });
    ok(updateProfileSchema, { fullName: "Budi", avatarUrl: "https://cdn.test/a.png" });
    ok(updateProfileSchema, { phone: "", address: "", avatarUrl: "" });
  });

  test("[negative] update profile field invalid", () => {
    fails(updateProfileSchema, { fullName: "" });
    fails(updateProfileSchema, { avatarUrl: "not-url" });
    fails(updateProfileSchema, { phone: "abc" });
  });

  test("[negative] update profile membuang field sensitif (role/password tidak ikut)", () => {
    expect(ok(updateProfileSchema, { fullName: "Budi", roleId: UUID, password: "x" })).toEqual({
      fullName: "Budi",
    });
  });
});
