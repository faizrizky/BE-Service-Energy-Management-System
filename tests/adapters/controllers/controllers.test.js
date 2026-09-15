jest.mock("../../../src/application/use_cases/authentication/login.usecase", () => ({ login: jest.fn() }));
jest.mock("../../../src/application/use_cases/authentication/getMe.usecase", () => ({ getMe: jest.fn() }));
jest.mock("../../../src/application/use_cases/authentication/refreshToken.usecase", () => ({ refreshAccessToken: jest.fn() }));
jest.mock("../../../src/application/use_cases/authentication/logout.usecase", () => ({ logout: jest.fn() }));
jest.mock("../../../src/application/use_cases/device/device.usecase", () => ({
  listDevicesPaginated: jest.fn(),
  getDeviceById: jest.fn(),
  createDevice: jest.fn(),
  updateDevice: jest.fn(),
  deleteDevice: jest.fn(),
  powerDevice: jest.fn(),
  cancelRelayCommand: jest.fn(),
  pingDevice: jest.fn(),
  setDeviceInterval: jest.fn(),
  listChirpstackDeviceCandidates: jest.fn(),
  getDeviceChirpstackMetadata: jest.fn(),
  getDeviceTelemetryHistory: jest.fn(),
}));
jest.mock("../../../src/application/use_cases/room/room.usecase", () => ({
  listRoomsPaginated: jest.fn(),
  getRoomById: jest.fn(),
  listDevicesInRoom: jest.fn(),
  listRoomsSummary: jest.fn(),
  getRoomUsageSummary: jest.fn(),
  getRoomStats: jest.fn(),
  createRoom: jest.fn(),
  updateRoom: jest.fn(),
  deleteRoom: jest.fn(),
  powerRoom: jest.fn(),
  getDeviceLogs: jest.fn(),
}));
jest.mock("../../../src/application/use_cases/schedule/schedule.usecase", () => ({
  listSchedulesPaginated: jest.fn(),
  getScheduleById: jest.fn(),
  createSchedule: jest.fn(),
  updateSchedule: jest.fn(),
  deleteSchedule: jest.fn(),
}));
jest.mock("../../../src/application/use_cases/user/user.usecase", () => ({
  listUsersPaginated: jest.fn(),
  getUserById: jest.fn(),
  createUser: jest.fn(),
  updateUser: jest.fn(),
  deleteUser: jest.fn(),
  updateProfile: jest.fn(),
}));
jest.mock("../../../src/application/use_cases/role/role.usecase", () => ({
  listRolesPaginated: jest.fn(),
  getRoleById: jest.fn(),
  createRole: jest.fn(),
  updateRole: jest.fn(),
  deleteRole: jest.fn(),
  listPermissions: jest.fn(),
}));
jest.mock("../../../src/application/use_cases/gateway/gateway.usecase", () => ({
  listGatewaysPaginated: jest.fn(),
  getGatewayById: jest.fn(),
  createGateway: jest.fn(),
  updateGateway: jest.fn(),
  deleteGateway: jest.fn(),
}));
jest.mock("../../../src/application/use_cases/report/report.usecase", () => ({
  getDashboardSummary: jest.fn(),
  getDeviceUsage: jest.fn(),
  getRoomUsage: jest.fn(),
  getReportSummary: jest.fn(),
  exportEnergyReport: jest.fn(),
  toCsv: jest.fn(),
  toXlsx: jest.fn(),
  toPdf: jest.fn(),
  getEnergyUsageTimeline: jest.fn(),
  getTopRiskyRooms: jest.fn(),
  getActiveSchedules: jest.fn(),
}));
jest.mock("../../../src/frameworks/tools/redisClient", () => ({ getRedisClient: jest.fn() }));
jest.mock("../../../src/frameworks/chirpstack/client", () => ({ listApplications: jest.fn() }));

const { prisma } = require("../../../src/frameworks/database/prismaClient");
const { mockReq, mockRes } = require("../../helpers/http");
const { resetPrismaMock } = require("../../helpers/prisma");

const loginUC = require("../../../src/application/use_cases/authentication/login.usecase");
const getMeUC = require("../../../src/application/use_cases/authentication/getMe.usecase");
const refreshUC = require("../../../src/application/use_cases/authentication/refreshToken.usecase");
const logoutUC = require("../../../src/application/use_cases/authentication/logout.usecase");
const deviceUC = require("../../../src/application/use_cases/device/device.usecase");
const roomUC = require("../../../src/application/use_cases/room/room.usecase");
const scheduleUC = require("../../../src/application/use_cases/schedule/schedule.usecase");
const userUC = require("../../../src/application/use_cases/user/user.usecase");
const roleUC = require("../../../src/application/use_cases/role/role.usecase");
const gatewayUC = require("../../../src/application/use_cases/gateway/gateway.usecase");
const reportUC = require("../../../src/application/use_cases/report/report.usecase");
const { getRedisClient } = require("../../../src/frameworks/tools/redisClient");
const { listApplications } = require("../../../src/frameworks/chirpstack/client");

const auth = require("../../../src/adapters/controllers/auth.controller");
const device = require("../../../src/adapters/controllers/device.controller");
const room = require("../../../src/adapters/controllers/room.controller");
const schedule = require("../../../src/adapters/controllers/schedule.controller");
const user = require("../../../src/adapters/controllers/user.controller");
const role = require("../../../src/adapters/controllers/role.controller");
const gateway = require("../../../src/adapters/controllers/gateway.controller");
const report = require("../../../src/adapters/controllers/report.controller");

beforeEach(() => {
  resetPrismaMock(prisma);
  jest.clearAllMocks();
});

async function call(handler, reqOverrides = {}) {
  const req = mockReq(reqOverrides);
  const res = mockRes();
  const next = jest.fn();
  await handler(req, res, next);
  return { req, res, next };
}

const boom = () => Object.assign(new Error("boom"), { status: 500 });

/** Semua handler harus meneruskan error use case ke next(err), bukan crash/menjawab sendiri. */
function expectErrorForwarding(handler, mockFn, reqOverrides) {
  test("[negative] error use case diteruskan ke next(err)", async () => {
    const err = boom();
    mockFn.mockRejectedValue(err);
    const { res, next } = await call(handler, reqOverrides);
    expect(next).toHaveBeenCalledWith(err);
    expect(res.json).not.toHaveBeenCalled();
  });
}

describe("auth.controller", () => {
  test("[positive] login hanya meneruskan username & password (+req)", async () => {
    loginUC.login.mockResolvedValue({ accessToken: "a" });
    const { req, res } = await call(auth.loginController, { body: { username: "admin", password: "x", role: "hack" } });
    expect(loginUC.login).toHaveBeenCalledWith({ username: "admin", password: "x" }, req);
    expect(res.json).toHaveBeenCalledWith({ data: { accessToken: "a" } });
  });
  expectErrorForwarding(auth.loginController, loginUC.login, { body: {} });

  test("[positive] refresh, me, logout (204)", async () => {
    refreshUC.refreshAccessToken.mockResolvedValue({ accessToken: "b" });
    expect((await call(auth.refreshController, { body: { refreshToken: "t" } })).res.json).toHaveBeenCalledWith({ data: { accessToken: "b" } });

    getMeUC.getMe.mockResolvedValue({ id: "user-1" });
    await call(auth.meController);
    expect(getMeUC.getMe).toHaveBeenCalledWith("user-1");

    logoutUC.logout.mockResolvedValue();
    const { res } = await call(auth.logoutController, { body: { refreshToken: "t" } });
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalled();
  });
  expectErrorForwarding(auth.refreshController, refreshUC.refreshAccessToken, { body: {} });
  expectErrorForwarding(auth.meController, getMeUC.getMe);
  expectErrorForwarding(auth.logoutController, logoutUC.logout, { body: {} });
});

describe("device.controller", () => {
  test("[positive] index meng-convert paginasi query string ke number", async () => {
    deviceUC.listDevicesPaginated.mockResolvedValue({ data: [] });
    await call(device.index, { query: { page: "2", rowsPerPage: "20", search: "AC", roomId: "r1" } });
    expect(deviceUC.listDevicesPaginated).toHaveBeenCalledWith({
      search: "AC",
      roomId: "r1",
      gatewayId: undefined,
      createdFrom: undefined,
      createdTo: undefined,
      page: 2,
      rowsPerPage: 20,
    });
  });
  expectErrorForwarding(device.index, deviceUC.listDevicesPaginated);

  test("[positive/negative] show: ditemukan 200, tidak ada 404", async () => {
    deviceUC.getDeviceById.mockResolvedValueOnce({ id: "d1" }).mockResolvedValueOnce(null);
    expect((await call(device.show, { params: { id: "d1" } })).res.json).toHaveBeenCalledWith({ data: { id: "d1" } });
    const { res } = await call(device.show, { params: { id: "x" } });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("[positive] store 201, update 200, destroy 204", async () => {
    deviceUC.createDevice.mockResolvedValue({ id: "d1" });
    expect((await call(device.store, { body: { name: "A" } })).res.status).toHaveBeenCalledWith(201);
    deviceUC.updateDevice.mockResolvedValue({ id: "d1" });
    await call(device.update, { params: { id: "d1" }, body: { name: "B" } });
    expect(deviceUC.updateDevice).toHaveBeenCalledWith("d1", { name: "B" });
    deviceUC.deleteDevice.mockResolvedValue();
    expect((await call(device.destroy, { params: { id: "d1" } })).res.status).toHaveBeenCalledWith(204);
  });
  expectErrorForwarding(device.store, deviceUC.createDevice);
  expectErrorForwarding(device.update, deviceUC.updateDevice);
  expectErrorForwarding(device.destroy, deviceUC.deleteDevice);

  test("[positive] power pending -> 202 dengan userId dari token", async () => {
    deviceUC.powerDevice.mockResolvedValue({ status: "pending" });
    const { res } = await call(device.power, { params: { id: "d1" }, body: { action: "on" } });
    expect(deviceUC.powerDevice).toHaveBeenCalledWith("d1", "on", { userId: "user-1" });
    expect(res.status).toHaveBeenCalledWith(202);
  });

  test("[negative] power langsung gagal (bukan pending) -> 200 dengan status failed", async () => {
    deviceUC.powerDevice.mockResolvedValue({ status: "failed" });
    expect((await call(device.power, { params: { id: "d1" }, body: { action: "off" } })).res.status).toHaveBeenCalledWith(200);
  });

  test("[negative] power action tidak valid -> 400 tanpa memanggil use case", async () => {
    const { res } = await call(device.power, { params: { id: "d1" }, body: { action: "toggle" } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(deviceUC.powerDevice).not.toHaveBeenCalled();
  });
  expectErrorForwarding(device.power, deviceUC.powerDevice, { body: { action: "on" } });

  test("[positive] cancelPower", async () => {
    deviceUC.cancelRelayCommand.mockResolvedValue({ cancelled: [] });
    const { res } = await call(device.cancelPower, { params: { id: "d1" } });
    expect(deviceUC.cancelRelayCommand).toHaveBeenCalledWith("d1");
    expect(res.json).toHaveBeenCalledWith({ data: { cancelled: [] } });
  });
  expectErrorForwarding(device.cancelPower, deviceUC.cancelRelayCommand);

  test("[positive/negative] ping: timeout di-convert, tanpa body -> undefined", async () => {
    deviceUC.pingDevice.mockResolvedValue({});
    await call(device.ping, { params: { id: "d1" }, body: { timeout: "5000" } });
    expect(deviceUC.pingDevice).toHaveBeenLastCalledWith("d1", { timeout: 5000 });
    await call(device.ping, { params: { id: "d1" }, body: undefined });
    expect(deviceUC.pingDevice).toHaveBeenLastCalledWith("d1", { timeout: undefined });
  });
  expectErrorForwarding(device.ping, deviceUC.pingDevice);

  test("[positive] interval, metadata, telemetry history, candidates", async () => {
    deviceUC.setDeviceInterval.mockResolvedValue({});
    await call(device.interval, { params: { id: "d1" }, body: { intervalMinutes: "30" } });
    expect(deviceUC.setDeviceInterval).toHaveBeenCalledWith("d1", { intervalMinutes: 30, userId: "user-1" });

    deviceUC.getDeviceChirpstackMetadata.mockResolvedValue({ a: 1 });
    expect((await call(device.chirpstackMetadata, { params: { id: "d1" } })).res.json).toHaveBeenCalledWith({ data: { a: 1 } });

    deviceUC.getDeviceTelemetryHistory.mockResolvedValue({ points: [] });
    await call(device.telemetryHistory, { params: { id: "d1" }, query: { from: "a", to: "b", limit: "5" } });
    expect(deviceUC.getDeviceTelemetryHistory).toHaveBeenCalledWith("d1", { from: "a", to: "b", limit: "5" });

    deviceUC.listChirpstackDeviceCandidates.mockResolvedValue({ data: [] });
    await call(device.chirpstackCandidates, { query: {} });
    expect(deviceUC.listChirpstackDeviceCandidates).toHaveBeenCalledWith({ page: 0, pageSize: 50 });
  });
  expectErrorForwarding(device.interval, deviceUC.setDeviceInterval, { body: {} });
  expectErrorForwarding(device.chirpstackMetadata, deviceUC.getDeviceChirpstackMetadata);
  expectErrorForwarding(device.telemetryHistory, deviceUC.getDeviceTelemetryHistory);
  expectErrorForwarding(device.chirpstackCandidates, deviceUC.listChirpstackDeviceCandidates);
});

describe("room.controller", () => {
  test("[positive] index, show (200/404), summary, stats, usageSummary", async () => {
    roomUC.listRoomsPaginated.mockResolvedValue({ data: [] });
    await call(room.index, { query: { page: "3" } });
    expect(roomUC.listRoomsPaginated).toHaveBeenCalledWith(expect.objectContaining({ page: 3, rowsPerPage: 10 }));

    roomUC.getRoomById.mockResolvedValueOnce({ id: "r1" }).mockResolvedValueOnce(null);
    expect((await call(room.show, { params: { id: "r1" } })).res.json).toHaveBeenCalledWith({ data: { id: "r1" } });
    expect((await call(room.show, { params: { id: "x" } })).res.status).toHaveBeenCalledWith(404);

    roomUC.listRoomsSummary.mockResolvedValue([]);
    await call(room.summary, { query: { search: "a" } });
    expect(roomUC.listRoomsSummary).toHaveBeenCalledWith({ search: "a" });

    roomUC.getRoomStats.mockResolvedValue({});
    await call(room.stats);
    roomUC.getRoomUsageSummary.mockResolvedValue({});
    await call(room.usageSummary, { params: { id: "r1" } });
    expect(roomUC.getRoomUsageSummary).toHaveBeenCalledWith("r1");
  });

  test("[positive/negative] devices: room ada -> daftar device; tidak ada -> 404", async () => {
    roomUC.getRoomById.mockResolvedValueOnce({ id: "r1" }).mockResolvedValueOnce(null);
    roomUC.listDevicesInRoom.mockResolvedValue({ data: [] });
    await call(room.devices, { params: { id: "r1" }, query: { page: "2" } });
    expect(roomUC.listDevicesInRoom).toHaveBeenCalledWith("r1", expect.objectContaining({ page: 2 }));
    const { res } = await call(room.devices, { params: { id: "x" } });
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("[positive] store 201, update, destroy 204, deviceLogs", async () => {
    roomUC.createRoom.mockResolvedValue({});
    expect((await call(room.store)).res.status).toHaveBeenCalledWith(201);
    roomUC.updateRoom.mockResolvedValue({});
    await call(room.update, { params: { id: "r1" }, body: { name: "x" } });
    roomUC.deleteRoom.mockResolvedValue();
    expect((await call(room.destroy, { params: { id: "r1" } })).res.status).toHaveBeenCalledWith(204);
    roomUC.getDeviceLogs.mockResolvedValue([]);
    await call(room.deviceLogs, { params: { id: "r1", deviceId: "d1" } });
    expect(roomUC.getDeviceLogs).toHaveBeenCalledWith("r1", "d1");
  });

  test("[positive/negative] power: ada pending -> 202, semua gagal -> 200, action invalid -> 400", async () => {
    roomUC.powerRoom.mockResolvedValueOnce({ summary: { pending: 2 } }).mockResolvedValueOnce({ summary: { pending: 0 } });
    expect((await call(room.power, { params: { id: "r1" }, body: { action: "on" } })).res.status).toHaveBeenCalledWith(202);
    expect((await call(room.power, { params: { id: "r1" }, body: { action: "on" } })).res.status).toHaveBeenCalledWith(200);
    expect((await call(room.power, { params: { id: "r1" }, body: {} })).res.status).toHaveBeenCalledWith(400);
    expect(roomUC.powerRoom).toHaveBeenCalledTimes(2);
  });

  for (const [name, fn, extra] of [
    ["index", "listRoomsPaginated"],
    ["show", "getRoomById"],
    ["devices", "getRoomById"],
    ["summary", "listRoomsSummary"],
    ["usageSummary", "getRoomUsageSummary"],
    ["stats", "getRoomStats"],
    ["store", "createRoom"],
    ["update", "updateRoom"],
    ["destroy", "deleteRoom"],
    ["power", "powerRoom", { body: { action: "off" } }],
    ["deviceLogs", "getDeviceLogs"],
  ]) {
    describe(`room.${name}`, () => expectErrorForwarding(room[name], roomUC[fn], extra));
  }
});

describe.each([
  ["schedule", schedule, scheduleUC, { index: "listSchedulesPaginated", show: "getScheduleById", store: "createSchedule", update: "updateSchedule", destroy: "deleteSchedule" }, "Schedule tidak ditemukan"],
  ["user", user, userUC, { index: "listUsersPaginated", show: "getUserById", store: "createUser", update: "updateUser", destroy: "deleteUser" }, "User tidak ditemukan"],
  ["role", role, roleUC, { index: "listRolesPaginated", show: "getRoleById", store: "createRole", update: "updateRole", destroy: "deleteRole" }, "Role tidak ditemukan"],
  ["gateway", gateway, gatewayUC, { index: "listGatewaysPaginated", show: "getGatewayById", store: "createGateway", update: "updateGateway", destroy: "deleteGateway" }, "Gateway tidak ditemukan"],
])("%s.controller (CRUD standar)", (_, controller, useCase, fns, notFoundMessage) => {
  test("[positive] index: paginasi dari query string di-convert ke number", async () => {
    useCase[fns.index].mockResolvedValue({ data: [] });
    const { res } = await call(controller.index, { query: { page: "4", rowsPerPage: "25" } });
    expect(useCase[fns.index]).toHaveBeenCalledWith(expect.objectContaining({ page: 4, rowsPerPage: 25 }));
    expect(res.json).toHaveBeenCalledWith({ data: { data: [] } });
  });

  test("[positive] index tanpa query -> default 1 & 10", async () => {
    useCase[fns.index].mockResolvedValue({ data: [] });
    await call(controller.index, { query: {} });
    expect(useCase[fns.index]).toHaveBeenCalledWith(expect.objectContaining({ page: 1, rowsPerPage: 10 }));
  });

  test("[positive/negative] show ditemukan 200 / tidak ditemukan 404", async () => {
    useCase[fns.show].mockResolvedValueOnce({ id: "1" }).mockResolvedValueOnce(null);
    expect((await call(controller.show, { params: { id: "1" } })).res.json).toHaveBeenCalledWith({ data: { id: "1" } });
    const { res } = await call(controller.show, { params: { id: "x" } });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: notFoundMessage });
  });

  test("[positive] store 201, update meneruskan id+body, destroy 204", async () => {
    useCase[fns.store].mockResolvedValue({ id: "1" });
    expect((await call(controller.store, { body: { a: 1 } })).res.status).toHaveBeenCalledWith(201);
    useCase[fns.update].mockResolvedValue({ id: "1" });
    await call(controller.update, { params: { id: "1" }, body: { a: 2 } });
    expect(useCase[fns.update]).toHaveBeenCalledWith("1", { a: 2 });
    useCase[fns.destroy].mockResolvedValue();
    expect((await call(controller.destroy, { params: { id: "1" } })).res.status).toHaveBeenCalledWith(204);
  });

  for (const key of ["index", "show", "store", "update", "destroy"]) {
    describe(key, () => expectErrorForwarding(controller[key], useCase[fns[key]]));
  }
});

describe("controller khusus", () => {
  test("[positive] schedule.store memakai id user dari token sebagai pembuat", async () => {
    scheduleUC.createSchedule.mockResolvedValue({});
    await call(schedule.store, { body: { roomId: "r1" } });
    expect(scheduleUC.createSchedule).toHaveBeenCalledWith({ roomId: "r1" }, "user-1");
  });

  test("[positive] user.updateMyProfile hanya untuk user yang login", async () => {
    userUC.updateProfile.mockResolvedValue({});
    await call(user.updateMyProfile, { params: { id: "orang-lain" }, body: { fullName: "x" } });
    expect(userUC.updateProfile).toHaveBeenCalledWith("user-1", { fullName: "x" });
  });
  expectErrorForwarding(user.updateMyProfile, userUC.updateProfile);

  test("[positive] role.permissionsList", async () => {
    roleUC.listPermissions.mockResolvedValue([{ id: "p1" }]);
    expect((await call(role.permissionsList)).res.json).toHaveBeenCalledWith({ data: [{ id: "p1" }] });
  });
  expectErrorForwarding(role.permissionsList, roleUC.listPermissions);
});

describe("report.controller", () => {
  test("[positive] range default 'today' untuk usage, timeline & risky rooms; status default 'active'", async () => {
    for (const fn of ["getDeviceUsage", "getRoomUsage", "getEnergyUsageTimeline", "getTopRiskyRooms", "getActiveSchedules", "getDashboardSummary"]) {
      reportUC[fn].mockResolvedValue({});
    }
    await call(report.deviceUsage, { params: { id: "d1" } });
    expect(reportUC.getDeviceUsage).toHaveBeenCalledWith("d1", "today");
    await call(report.roomUsage, { params: { id: "r1" }, query: { range: "week" } });
    expect(reportUC.getRoomUsage).toHaveBeenCalledWith("r1", "week");
    await call(report.energyUsageTimeline);
    expect(reportUC.getEnergyUsageTimeline).toHaveBeenCalledWith("today");
    await call(report.topRiskyRooms, { query: { range: "last_week" } });
    expect(reportUC.getTopRiskyRooms).toHaveBeenCalledWith("last_week");
    await call(report.activeSchedules);
    expect(reportUC.getActiveSchedules).toHaveBeenCalledWith("active");
    await call(report.dashboardSummary);
    expect(reportUC.getDashboardSummary).toHaveBeenCalled();
  });

  test("[positive] reportSummary meneruskan filter", async () => {
    reportUC.getReportSummary.mockResolvedValue([]);
    await call(report.reportSummary, { query: { roomId: "r1", from: "2026-09-01", to: "2026-09-02", extra: "x" } });
    expect(reportUC.getReportSummary).toHaveBeenCalledWith({ roomId: "r1", deviceId: undefined, from: "2026-09-01", to: "2026-09-02" });
  });

  const exportQuery = { from: "2026-09-01", to: "2026-09-02" };

  test.each([
    ["csv", "toCsv", "text/csv", "energy-report-2026-09-01_to_2026-09-02.csv"],
    ["xlsx", "toXlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "energy-report-2026-09-01_to_2026-09-02.xlsx"],
    ["pdf", "toPdf", "application/pdf", "energy-report-2026-09-01_to_2026-09-02.pdf"],
  ])("[positive] export %s -> Content-Type & nama file attachment", async (format, fn, type, filename) => {
    reportUC.exportEnergyReport.mockResolvedValue([{ a: 1 }]);
    reportUC[fn].mockResolvedValue("FILE");
    const { res } = await call(report.exportEnergy, { query: { ...exportQuery, format } });
    expect(reportUC[fn]).toHaveBeenCalledWith([{ a: 1 }]);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", type);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Disposition", `attachment; filename="${filename}"`);
    expect(res.send).toHaveBeenCalled();
  });

  test("[negative] format tidak dikenal / kosong -> JSON biasa", async () => {
    reportUC.exportEnergyReport.mockResolvedValue([{ a: 1 }]);
    const { res } = await call(report.exportEnergy, { query: { ...exportQuery, format: "docx" } });
    expect(res.json).toHaveBeenCalledWith({ data: [{ a: 1 }] });
    expect(res.setHeader).not.toHaveBeenCalled();
  });

  test("[negative] konversi file gagal -> next(err)", async () => {
    reportUC.exportEnergyReport.mockResolvedValue([]);
    reportUC.toPdf.mockRejectedValue(new Error("pdf error"));
    const { next } = await call(report.exportEnergy, { query: { ...exportQuery, format: "pdf" } });
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "pdf error" }));
  });

  for (const [name, fn] of [
    ["dashboardSummary", "getDashboardSummary"],
    ["deviceUsage", "getDeviceUsage"],
    ["roomUsage", "getRoomUsage"],
    ["reportSummary", "getReportSummary"],
    ["exportEnergy", "exportEnergyReport"],
    ["energyUsageTimeline", "getEnergyUsageTimeline"],
    ["topRiskyRooms", "getTopRiskyRooms"],
    ["activeSchedules", "getActiveSchedules"],
  ]) {
    describe(`report.${name}`, () => expectErrorForwarding(report[name], reportUC[fn]));
  }
});

describe("health.controller", () => {
  function loadHealth(nodeEnv) {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = nodeEnv;
    let mod;
    jest.isolateModules(() => {
      mod = require("../../../src/adapters/controllers/health.controller");
    });
    process.env.NODE_ENV = previous;
    return mod;
  }

  test("[positive] semua dependensi sehat -> 200", async () => {
    const { healthCheck } = loadHealth("test");
    prisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);
    getRedisClient.mockReturnValue({ ping: jest.fn().mockResolvedValue("PONG") });
    listApplications.mockResolvedValue({});
    const res = mockRes();
    await healthCheck(mockReq(), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ app: "ok", database: "ok", redis: "ok", chirpstack: "ok" });
  });

  test("[negative] satu dependensi mati -> 503 dengan detail error (non-production)", async () => {
    const { healthCheck } = loadHealth("development");
    prisma.$queryRaw.mockRejectedValue(new Error("ECONNREFUSED 5432"));
    getRedisClient.mockReturnValue({ ping: jest.fn().mockResolvedValue("PONG") });
    listApplications.mockResolvedValue({});
    const res = mockRes();
    await healthCheck(mockReq(), res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json.mock.calls[0][0].database).toBe("error: ECONNREFUSED 5432");
  });

  test("[negative] production -> pesan error disembunyikan; redis jawab aneh; client belum init", async () => {
    const { healthCheck } = loadHealth("production");
    prisma.$queryRaw.mockResolvedValue([]);
    getRedisClient.mockReturnValue({ ping: jest.fn().mockResolvedValue("NOPE") });
    listApplications.mockRejectedValue(new Error("secret internal host"));
    const res = mockRes();
    await healthCheck(mockReq(), res);
    expect(res.json).toHaveBeenCalledWith({ app: "ok", database: "ok", redis: "unexpected response", chirpstack: "error" });

    getRedisClient.mockImplementation(() => {
      throw new Error("belum init");
    });
    const res2 = mockRes();
    await healthCheck(mockReq(), res2);
    expect(res2.json.mock.calls[0][0].redis).toBe("error");
  });
});
