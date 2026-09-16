jest.mock("../../../src/application/use_cases/gateway/gateway.usecase", () => ({
  syncGatewaysFromChirpstack: jest.fn(),
}));
jest.mock("../../../src/application/use_cases/device/device.usecase", () => ({
  syncDevicesFromChirpstack: jest.fn(),
}));

const gatewayUseCase = require("../../../src/application/use_cases/gateway/gateway.usecase");
const deviceUseCase = require("../../../src/application/use_cases/device/device.usecase");
const logger = require("../../../src/frameworks/helpers/logger");
const job = require("../../../src/frameworks/queue/gatewaySyncJob");

beforeEach(() => jest.clearAllMocks());

describe("gatewaySyncJob", () => {
  test("[positive] satu tick nyinkronin device dulu, baru gateway", async () => {
    const order = [];
    deviceUseCase.syncDevicesFromChirpstack.mockImplementation(async () => { order.push("device"); });
    gatewayUseCase.syncGatewaysFromChirpstack.mockImplementation(async () => { order.push("gateway"); });

    await job.runTick();

    expect(order).toEqual(["device", "gateway"]);
  });

  test("[negative] sinkronisasi gagal -> cuma warning, job nggak mati", async () => {
    deviceUseCase.syncDevicesFromChirpstack.mockResolvedValue({});
    gatewayUseCase.syncGatewaysFromChirpstack.mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(job.runTick()).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("ECONNREFUSED"));
  });

  test("[negative] tick sebelumnya masih jalan -> tick baru di-skip", async () => {
    let release;
    deviceUseCase.syncDevicesFromChirpstack.mockResolvedValue({});
    gatewayUseCase.syncGatewaysFromChirpstack.mockImplementation(
      () => new Promise((resolve) => { release = resolve; }),
    );

    const first = job.runTick();
    await job.runTick();
    expect(gatewayUseCase.syncGatewaysFromChirpstack).toHaveBeenCalledTimes(1);

    release();
    await first;
  });

  test("[positive] startGatewaySync jalan sekali di awal & pasang interval 1 menit", () => {
    jest.useFakeTimers();
    try {
      deviceUseCase.syncDevicesFromChirpstack.mockResolvedValue({});
      gatewayUseCase.syncGatewaysFromChirpstack.mockResolvedValue({ checked: 0, updated: 0 });
      const interval = job.startGatewaySync();
      expect(deviceUseCase.syncDevicesFromChirpstack).toHaveBeenCalledTimes(1);
      expect(job.TICK_MS).toBe(60000);
      clearInterval(interval);
    } finally {
      jest.useRealTimers();
    }
  });
});
