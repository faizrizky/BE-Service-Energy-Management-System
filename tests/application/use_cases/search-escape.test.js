// Semua pencarian list harus nge-escape % dan _ sebelum masuk `contains`
// Prisma, kalau nggak nyari "%" malah ngebalikin semua data (TS-086, TS-094).
const { prisma } = require("../../../src/frameworks/database/prismaClient");
const { resetPrismaMock } = require("../../helpers/prisma");

const RAW = "50%_off";
const ESCAPED = "50\\%\\_off";

const uc = (p) => require(`../../../src/application/use_cases/${p}`);

const CASES = [
  ["role.listRolesPaginated", () => uc("role/role.usecase").listRolesPaginated({ search: RAW })],
  ["user.listUsersPaginated", () => uc("user/user.usecase").listUsersPaginated({ search: RAW })],
  ["device.listDevicesPaginated", () => uc("device/device.usecase").listDevicesPaginated({ search: RAW })],
  ["gateway.listGatewaysPaginated", () => uc("gateway/gateway.usecase").listGatewaysPaginated({ search: RAW })],
  ["schedule.listSchedulesPaginated", () => uc("schedule/schedule.usecase").listSchedulesPaginated({ search: RAW })],
  ["room.listRoomsPaginated", () => uc("room/room.usecase").listRoomsPaginated({ search: RAW })],
  ["room.getRoomById", () => uc("room/room.usecase").getRoomById("r1", { search: RAW })],
  ["room.listDevicesInRoom", () => uc("room/room.usecase").listDevicesInRoom("r1", { search: RAW })],
  ["notification.findNotification", () => uc("notification/find.usecase").findNotification(1, 10, RAW)],
];

beforeEach(() => {
  resetPrismaMock(prisma);
  for (const model of Object.values(prisma)) {
    if (!model || typeof model !== "object") continue;
    model.count?.mockResolvedValue?.(0);
    model.findMany?.mockResolvedValue?.([]);
    model.findUnique?.mockResolvedValue?.({ id: "r1", name: "Room", devices: [] });
    model.aggregate?.mockResolvedValue?.({ _sum: {}, _avg: {}, _count: 0 });
    model.groupBy?.mockResolvedValue?.([]);
  }
  prisma.$queryRaw?.mockResolvedValue?.([]);
});

/** Semua argumen yang dikirim ke prisma (where dll) dijadiin satu string JSON. */
function prismaCallsJson() {
  const calls = [];
  for (const model of Object.values(prisma)) {
    if (!model || typeof model !== "object") continue;
    for (const fn of Object.values(model)) if (fn?.mock) calls.push(...fn.mock.calls);
  }
  return JSON.stringify(calls);
}

describe("pencarian nge-escape wildcard LIKE", () => {
  test.each(CASES)("[positive] %s -> contains pakai kata yang udah di-escape", async (_, run) => {
    await run().catch(() => {});
    const json = prismaCallsJson();
    expect(json).toContain(JSON.stringify(ESCAPED).slice(1, -1));
    expect(json).not.toMatch(/"contains":"50%_off"/);
  });
});
