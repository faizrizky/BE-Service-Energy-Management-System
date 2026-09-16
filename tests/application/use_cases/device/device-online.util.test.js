const {
  getOnlineWindowMs,
  getOnlineUntil,
  isDeviceOnline,
} = require("../../../../src/application/use_cases/device/device-online.util");

const minutesAgo = (m) => new Date(Date.now() - m * 60000);
const device = (overrides = {}) => ({
  intervalMinutes: 15,
  lastSeenAt: minutesAgo(1),
  ...overrides,
});

describe("getOnlineWindowMs", () => {
  test("[positive] satu interval + masa tenggang 2 menit", () => {
    expect(getOnlineWindowMs(device())).toBe(15 * 60000 + 120000);
  });

  test("[negative] interval kosong -> tinggal masa tenggang", () => {
    expect(getOnlineWindowMs(device({ intervalMinutes: null }))).toBe(120000);
  });
});

describe("isDeviceOnline", () => {
  test("[positive] uplink terakhir masih di dalam jendela", () => {
    expect(isDeviceOnline(device({ lastSeenAt: minutesAgo(16) }))).toBe(true);
  });

  // Dulu pakai 2x interval, device mati baru kelihatan 30 menit kemudian.
  test("[negative] lewat interval + tenggang -> offline", () => {
    expect(isDeviceOnline(device({ lastSeenAt: minutesAgo(18) }))).toBe(false);
  });

  test("[negative] belum pernah kirim uplink -> offline", () => {
    expect(isDeviceOnline(device({ lastSeenAt: null }))).toBe(false);
  });

  test("[edge] pas di batas -> masih online", () => {
    const now = new Date();
    const d = device({ lastSeenAt: new Date(now.getTime() - (15 * 60000 + 120000)) });
    expect(isDeviceOnline(d, now)).toBe(true);
  });
});

describe("getOnlineUntil", () => {
  test("[positive] lastSeenAt + jendela online", () => {
    const lastSeenAt = new Date("2026-09-16T10:00:00.000Z");
    expect(getOnlineUntil(device({ lastSeenAt }))).toEqual(
      new Date("2026-09-16T10:17:00.000Z"),
    );
  });

  test("[negative] belum pernah kirim uplink -> null", () => {
    expect(getOnlineUntil(device({ lastSeenAt: null }))).toBeNull();
  });
});
