const client = require("../../../src/frameworks/chirpstack/client");
const { fetchResponse } = require("../../helpers/http");

const BASE = "http://chirpstack.test";
const DEV_EUI = "08000000410000e4";
const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
});

function lastCall() {
  const [url, options] = global.fetch.mock.calls.at(-1);
  return { url, options, body: options.body ? JSON.parse(options.body) : undefined };
}

describe("csRequest", () => {
  test("[positive] response JSON sukses dikembalikan apa adanya", async () => {
    global.fetch.mockResolvedValue(fetchResponse({ body: { success: true, data: { a: 1 } } }));
    await expect(client.csRequest("/api/x")).resolves.toEqual({ success: true, data: { a: 1 } });

    const { url, options } = lastCall();
    expect(url).toBe(`${BASE}/api/x`);
    expect(options.headers["Content-Type"]).toBe("application/json");
    expect(options.signal).toBeDefined();
  });

  test("[positive] body kosong (mis. 204) -> null", async () => {
    global.fetch.mockResolvedValue(fetchResponse({ status: 204 }));
    await expect(client.csRequest("/api/x", { method: "DELETE" })).resolves.toBeNull();
  });

  test("[positive] header tambahan digabung tanpa menghapus Content-Type", async () => {
    global.fetch.mockResolvedValue(fetchResponse({ body: {} }));
    await client.csRequest("/api/x", { headers: { "X-Trace": "1" } });
    expect(lastCall().options.headers).toEqual({ "Content-Type": "application/json", "X-Trace": "1" });
  });

  test("[negative] network error dibungkus dengan path & cause", async () => {
    const cause = new Error("ECONNREFUSED");
    global.fetch.mockRejectedValue(cause);
    const err = await client.csRequest("/api/x").catch((e) => e);
    expect(err.message).toBe("[ChirpStack] Request gagal ke /api/x: ECONNREFUSED");
    expect(err.cause).toBe(cause);
  });

  test("[negative] body bukan JSON -> error dengan status HTTP", async () => {
    global.fetch.mockResolvedValue(fetchResponse({ status: 502, body: "<html>Bad Gateway</html>" }));
    await expect(client.csRequest("/api/x")).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("Gagal parse JSON dari /api/x (status 502)"),
    });
  });

  test("[negative] HTTP 408 dengan pesan error -> status & pesan middleware diteruskan", async () => {
    global.fetch.mockResolvedValue(
      fetchResponse({ status: 408, body: { success: false, error: "Meter tidak merespons wake-up" } }),
    );
    await expect(client.csRequest("/api/relay/wake")).rejects.toMatchObject({
      status: 408,
      message: "[ChirpStack] HTTP 408 di /api/relay/wake: Meter tidak merespons wake-up",
      body: { success: false, error: "Meter tidak merespons wake-up" },
    });
  });

  test("[negative] HTTP 200 tapi success:false -> tetap dianggap error", async () => {
    global.fetch.mockResolvedValue(fetchResponse({ body: { success: false, message: "invalid" } }));
    await expect(client.csRequest("/api/x")).rejects.toMatchObject({
      status: 200,
      message: expect.stringContaining("invalid"),
    });
  });

  test("[negative] HTTP 500 tanpa field error/message -> pesan memakai body mentah", async () => {
    global.fetch.mockResolvedValue(fetchResponse({ status: 500, body: { foo: "bar" } }));
    await expect(client.csRequest("/api/x")).rejects.toThrow('HTTP 500 di /api/x: {"foo":"bar"}');
  });
});

describe("endpoint helpers", () => {
  beforeEach(() => {
    global.fetch.mockResolvedValue(fetchResponse({ body: { success: true } }));
  });

  test("[positive] listGateways memakai limit/offset default & custom", async () => {
    await client.listGateways();
    expect(lastCall().url).toBe(`${BASE}/api/chirpstack/gateways?limit=10&offset=0`);
    await client.listGateways({ limit: 50, offset: 20 });
    expect(lastCall().url).toBe(`${BASE}/api/chirpstack/gateways?limit=50&offset=20`);
  });

  test("[positive] CRUD gateway memakai method & body yang benar", async () => {
    await client.getGateway("gw1");
    expect(lastCall().url).toBe(`${BASE}/api/chirpstack/gateways/gw1`);
    await client.createGateway({ name: "G" });
    expect(lastCall()).toMatchObject({ options: { method: "POST" }, body: { name: "G" } });
    await client.updateGateway("gw1", { name: "H" });
    expect(lastCall()).toMatchObject({ options: { method: "PUT" }, body: { name: "H" } });
    await client.deleteGateway("gw1");
    expect(lastCall().options.method).toBe("DELETE");
  });

  test("[positive] listApplications & listCsDevices (default applicationId dari config)", async () => {
    await client.listApplications();
    expect(lastCall().url).toBe(`${BASE}/api/chirpstack/applications`);
    await client.listCsDevices();
    expect(lastCall().url).toBe(`${BASE}/api/chirpstack/devices?applicationId=app-test`);
    await client.listCsDevices("other-app");
    expect(lastCall().url).toBe(`${BASE}/api/chirpstack/devices?applicationId=other-app`);
  });

  test("[positive] devEUI huruf besar dinormalisasi ke huruf kecil di URL/body", async () => {
    await client.getCsDevice("08000000410000E4");
    expect(lastCall().url).toBe(`${BASE}/api/chirpstack/devices/${DEV_EUI}`);
  });

  test("[negative] devEUI tidak valid -> 400 sebelum request dikirim", async () => {
    for (const fn of [client.getCsDevice, client.deleteCsDevice]) {
      expect(() => fn("bad")).toThrow(expect.objectContaining({ status: 400 }));
    }
    expect(() => client.updateCsDevice(null, {})).toThrow("devEUI tidak valid");
    expect(() => client.pingTelemetry("x")).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => client.setRelay("x", true)).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => client.setReportInterval("x", 60)).toThrow(expect.objectContaining({ status: 400 }));
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test("[positive] createCsDevice menambahkan applicationId & deviceProfileId dari config", async () => {
    await client.createCsDevice({ devEui: "08000000410000E4", name: "Meter" });
    expect(lastCall().body).toEqual({
      applicationId: "app-test",
      deviceProfileId: "profile-test",
      devEui: DEV_EUI,
      name: "Meter",
    });
  });

  test("[negative] createCsDevice tanpa devEui -> 400", () => {
    expect(() => client.createCsDevice({ name: "Meter" })).toThrow(expect.objectContaining({ status: 400 }));
  });

  test("[positive] pingTelemetry mengirim timeout (default 120000) di body", async () => {
    await client.pingTelemetry(DEV_EUI);
    expect(lastCall().body).toEqual({ devEUI: DEV_EUI, applicationId: "app-test", timeout: 120000 });
    await client.pingTelemetry(DEV_EUI, { timeout: 5000 });
    expect(lastCall().body.timeout).toBe(5000);
  });

  test("[positive] setRelay ON/OFF -> relay 1/0 dengan timeout default & custom", async () => {
    await client.setRelay(DEV_EUI, true);
    expect(lastCall().body).toEqual({
      devEUI: DEV_EUI,
      applicationId: "app-test",
      relay: 1,
      wakeTimeout: 60000,
      relayTimeout: 30000,
    });
    await client.setRelay(DEV_EUI, false, { wakeTimeout: 150000, relayTimeout: 90000 });
    expect(lastCall().body).toMatchObject({ relay: 0, wakeTimeout: 150000, relayTimeout: 90000 });
  });

  test("[positive] setReportInterval & topup", async () => {
    await client.setReportInterval(DEV_EUI, 1800);
    expect(lastCall()).toMatchObject({
      url: `${BASE}/api/interval`,
      body: { devEUI: DEV_EUI, applicationId: "app-test", interval: 1800 },
    });
    await client.topup(DEV_EUI, 50);
    expect(lastCall().body).toEqual({ devEUI: DEV_EUI, applicationId: "app-test", topup: 50, fPort: 112 });
  });

  // topup satu-satunya helper yang tidak memvalidasi devEUI.
  test.failing("[BUG] topup dengan devEUI tidak valid seharusnya ditolak sebelum request", () => {
    expect(() => client.topup("bad", 10)).toThrow();
  });
});
