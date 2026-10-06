const { EventEmitter } = require("events");

jest.mock("mqtt", () => ({ connect: jest.fn() }));
jest.mock("../../../src/application/use_cases/device/device.usecase", () => ({
  ingestUplink: jest.fn(),
  ingestTxAck: jest.fn(),
}));

const mqtt = require("mqtt");
const logger = require("../../../src/frameworks/helpers/logger");
const deviceUseCase = require("../../../src/application/use_cases/device/device.usecase");
const { config } = require("../../../src/config/config");
const {
  startUplinkSubscriber,
  handleMessage,
  uplinkTopic,
} = require("../../../src/frameworks/mqtt/uplinkSubscriber");

const TOPIC = "application/app-test/device/+/event/up";
const TXACK_TOPIC = "application/app-test/device/+/event/txack";
const flush = () => new Promise((r) => setImmediate(r));
const asPayload = (obj) => Buffer.from(JSON.stringify(obj));

function fakeClient() {
  const client = new EventEmitter();
  client.subscribe = jest.fn();
  return client;
}

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(config.mqtt, {
    url: "mqtt://broker.test:1883",
    username: "das",
    password: "rahasia",
    clientId: "ems-backend",
  });
});

describe("uplinkTopic", () => {
  test("[positive] cuma aplikasi EMS (CHIRPSTACK_APPLICATION_ID), bukan semua aplikasi", () => {
    expect(uplinkTopic()).toBe(TOPIC);
  });
});

describe("startUplinkSubscriber", () => {
  test("[positive] nyambung pakai kredensial dari config & auto-reconnect", () => {
    mqtt.connect.mockReturnValue(fakeClient());
    startUplinkSubscriber();
    expect(mqtt.connect).toHaveBeenCalledWith("mqtt://broker.test:1883", {
      username: "das",
      password: "rahasia",
      clientId: "ems-backend",
      reconnectPeriod: 5000,
    });
  });

  test("[positive] subscribe ulang tiap connect (termasuk setelah reconnect)", () => {
    const client = fakeClient();
    mqtt.connect.mockReturnValue(client);
    startUplinkSubscriber();

    client.emit("connect");
    client.emit("connect");

    expect(client.subscribe).toHaveBeenCalledTimes(2);
    expect(client.subscribe).toHaveBeenCalledWith([TOPIC, TXACK_TOPIC], { qos: 0 }, expect.any(Function));
  });

  test("[negative] subscribe ditolak broker -> dicatat error", () => {
    const client = fakeClient();
    client.subscribe.mockImplementation((_t, _o, cb) => cb(new Error("not authorized")));
    mqtt.connect.mockReturnValue(client);
    startUplinkSubscriber();

    client.emit("connect");

    expect(logger.error).toHaveBeenCalledWith("[MQTT] Gagal subscribe:", "not authorized");
  });

  test("[positive] pesan masuk diteruskan ke ingestUplink dalam bentuk JSON", async () => {
    const client = fakeClient();
    mqtt.connect.mockReturnValue(client);
    deviceUseCase.ingestUplink.mockResolvedValue({ id: "d1" });
    startUplinkSubscriber();

    const event = { deviceInfo: { devEui: "08000000410000e4" }, object: { relay_state: "ON" } };
    client.emit("message", "application/app-test/device/08000000410000e4/event/up", asPayload(event));
    await flush();

    expect(deviceUseCase.ingestUplink).toHaveBeenCalledWith(event);
  });

  test("[negative] error koneksi -> dicatat, nggak bikin proses crash", () => {
    const client = fakeClient();
    mqtt.connect.mockReturnValue(client);
    startUplinkSubscriber();

    expect(() => client.emit("error", new Error("ECONNREFUSED"))).not.toThrow();
    expect(logger.error).toHaveBeenCalledWith("[MQTT] Error:", "ECONNREFUSED");
  });
});

describe("handleMessage", () => {
  test("[negative] payload bukan JSON -> dilewati dengan warning", async () => {
    await handleMessage(TOPIC, Buffer.from("bukan json"));
    expect(deviceUseCase.ingestUplink).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("Payload bukan JSON"));
  });

  test("[negative] devEUI belum terdaftar -> warning cuma sekali walau uplink terus datang", async () => {
    deviceUseCase.ingestUplink.mockResolvedValue(null);
    const event = { deviceInfo: { devEui: "0800000000000024" } };

    await handleMessage(TOPIC, asPayload(event));
    await handleMessage(TOPIC, asPayload(event));

    const warns = logger.warn.mock.calls.filter(([msg]) => msg.includes("0800000000000024"));
    expect(warns).toHaveLength(1);
  });

  test("[positive] topic txack -> ingestTxAck, bukan ingestUplink", async () => {
    deviceUseCase.ingestTxAck.mockResolvedValue({ id: "c1" });
    const event = { deviceInfo: { devEui: "08000000410000e4" }, fCntDown: 3 };

    await handleMessage("application/app-test/device/08000000410000e4/event/txack", asPayload(event));

    expect(deviceUseCase.ingestTxAck).toHaveBeenCalledWith(event);
    expect(deviceUseCase.ingestUplink).not.toHaveBeenCalled();
  });

  test("[negative] txack tanpa perintah pending (null) -> nggak dianggap device asing", async () => {
    deviceUseCase.ingestTxAck.mockResolvedValue(null);
    await handleMessage(
      "application/app-test/device/0800000000000099/event/txack",
      asPayload({ deviceInfo: { devEui: "0800000000000099" } }),
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  test("[positive] uplink device terdaftar -> log debug ringkas (nama, relai, kWh, SNR)", async () => {
    deviceUseCase.ingestUplink.mockResolvedValue({ id: "d1" });
    await handleMessage(
      TOPIC,
      asPayload({
        deviceInfo: { devEui: "08000000410000e4", deviceName: "KwH Meter" },
        fPort: 102,
        object: { relay_state: "OFF", meter_reading: 207391 },
        rxInfo: [{ snr: 11.2 }],
      }),
    );
    expect(logger.debug).toHaveBeenCalledWith(
      "[MQTT] Uplink KwH Meter (fPort 102): relai OFF, 207.391 kWh, SNR 11.2",
    );
  });

  test("[negative] uplink device belum terdaftar -> nggak ada log debug uplink", async () => {
    deviceUseCase.ingestUplink.mockResolvedValue(null);
    await handleMessage(TOPIC, asPayload({ deviceInfo: { devEui: "0800000000000077" } }));
    expect(logger.debug).not.toHaveBeenCalled();
  });

  test("[positive] txack -> log debug nyebut perintah yang terkirim", async () => {
    deviceUseCase.ingestTxAck.mockResolvedValue({ id: "c1" });
    await handleMessage(
      "application/app-test/device/08000000410000e4/event/txack",
      asPayload({ deviceInfo: { devEui: "08000000410000e4", deviceName: "KwH Meter" } }),
    );
    expect(logger.debug).toHaveBeenCalledWith("[MQTT] Txack KwH Meter: perintah c1 terkirim ke meter");
  });

  test("[negative] ingestUplink error (misal database putus) -> dicatat, nggak throw", async () => {
    deviceUseCase.ingestUplink.mockRejectedValue(new Error("db down"));
    await expect(
      handleMessage(TOPIC, asPayload({ deviceInfo: { devEui: "08000000410000e4" } })),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("db down"));
  });
});
