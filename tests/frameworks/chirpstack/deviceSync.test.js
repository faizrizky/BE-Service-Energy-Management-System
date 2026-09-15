jest.mock("../../../src/frameworks/chirpstack/client", () => ({
  getCsDevice: jest.fn(),
  createCsDevice: jest.fn(),
  updateCsDevice: jest.fn(),
  deleteCsDevice: jest.fn(),
  setReportInterval: jest.fn(),
}));

const { config } = require("../../../src/config/config");
const logger = require("../../../src/frameworks/helpers/logger");
const cs = require("../../../src/frameworks/chirpstack/client");
const sync = require("../../../src/frameworks/chirpstack/deviceSync");

const DEV_EUI = "08000000410000e4";
const httpErr = (status) => Object.assign(new Error(`HTTP ${status}`), { status });
const originalProfile = config.chirpstack.deviceProfileId;

beforeEach(() => {
  jest.resetAllMocks();
  config.chirpstack.deviceProfileId = originalProfile;
});

describe("assertDeviceProfileConfigured", () => {
  test("[positive] profile terisi -> tidak melempar", () => {
    expect(() => sync.assertDeviceProfileConfigured()).not.toThrow();
  });

  test("[negative] profile kosong -> 500 dengan pesan konfigurasi", () => {
    config.chirpstack.deviceProfileId = undefined;
    expect(() => sync.assertDeviceProfileConfigured()).toThrow(
      expect.objectContaining({ status: 500, message: expect.stringContaining("CHIRPSTACK_DEVICE_PROFILE_ID") }),
    );
  });
});

describe("csDeviceExists", () => {
  test("[positive] device ditemukan -> true", async () => {
    cs.getCsDevice.mockResolvedValue({ data: {} });
    await expect(sync.csDeviceExists(DEV_EUI)).resolves.toBe(true);
  });

  test("[negative] 404 -> false", async () => {
    cs.getCsDevice.mockRejectedValue(httpErr(404));
    await expect(sync.csDeviceExists(DEV_EUI)).resolves.toBe(false);
  });

  test("[negative] error lain (500/network) dilempar ulang, tidak dianggap 'tidak ada'", async () => {
    cs.getCsDevice.mockRejectedValue(httpErr(500));
    await expect(sync.csDeviceExists(DEV_EUI)).rejects.toMatchObject({ status: 500 });
  });
});

describe("ensureCsDeviceRegistered", () => {
  test("[positive] belum terdaftar -> dibuat", async () => {
    cs.getCsDevice.mockRejectedValue(httpErr(404));
    await expect(
      sync.ensureCsDeviceRegistered(DEV_EUI, { name: "Meter", description: "KWH" }),
    ).resolves.toEqual({ created: true, updated: false });
    expect(cs.createCsDevice).toHaveBeenCalledWith({
      devEui: DEV_EUI,
      name: "Meter",
      description: "KWH",
      isDisabled: false,
    });
  });

  test("[positive] sudah terdaftar (default) -> nama/deskripsi di-update", async () => {
    cs.getCsDevice.mockResolvedValue({});
    await expect(sync.ensureCsDeviceRegistered(DEV_EUI, { name: "Meter" })).resolves.toEqual({
      created: false,
      updated: true,
    });
    expect(cs.updateCsDevice).toHaveBeenCalledWith(DEV_EUI, { name: "Meter", description: "" });
    expect(cs.createCsDevice).not.toHaveBeenCalled();
  });

  test("[positive] sudah terdaftar & updateIfExists:false -> tidak diubah", async () => {
    cs.getCsDevice.mockResolvedValue({});
    await expect(
      sync.ensureCsDeviceRegistered(DEV_EUI, { name: "Meter", updateIfExists: false }),
    ).resolves.toEqual({ created: false, updated: false });
    expect(cs.updateCsDevice).not.toHaveBeenCalled();
  });

  test("[negative] profile belum dikonfigurasi -> gagal sebelum memanggil ChirpStack", async () => {
    config.chirpstack.deviceProfileId = "";
    await expect(sync.ensureCsDeviceRegistered(DEV_EUI, { name: "M" })).rejects.toMatchObject({ status: 500 });
    expect(cs.getCsDevice).not.toHaveBeenCalled();
  });

  test("[negative] create gagal -> error diteruskan", async () => {
    cs.getCsDevice.mockRejectedValue(httpErr(404));
    cs.createCsDevice.mockRejectedValue(httpErr(409));
    await expect(sync.ensureCsDeviceRegistered(DEV_EUI, { name: "M" })).rejects.toMatchObject({ status: 409 });
  });
});

describe("removeCsDevice", () => {
  test("[positive] berhasil dihapus", async () => {
    cs.deleteCsDevice.mockResolvedValue(null);
    await expect(sync.removeCsDevice(DEV_EUI)).resolves.toEqual({ deleted: true, reason: null });
  });

  test("[positive] sudah tidak ada (404) diabaikan secara default", async () => {
    cs.deleteCsDevice.mockRejectedValue(httpErr(404));
    await expect(sync.removeCsDevice(DEV_EUI)).resolves.toEqual({ deleted: false, reason: "not_found" });
    expect(logger.warn).toHaveBeenCalled();
  });

  test("[negative] 404 dengan ignoreMissing:false -> dilempar", async () => {
    cs.deleteCsDevice.mockRejectedValue(httpErr(404));
    await expect(sync.removeCsDevice(DEV_EUI, { ignoreMissing: false })).rejects.toMatchObject({ status: 404 });
  });

  test("[negative] error selain 404 -> dilempar", async () => {
    cs.deleteCsDevice.mockRejectedValue(httpErr(500));
    await expect(sync.removeCsDevice(DEV_EUI)).rejects.toMatchObject({ status: 500 });
  });
});

describe("rollbackCsDevice", () => {
  test("[positive] rollback sukses -> true", async () => {
    cs.deleteCsDevice.mockResolvedValue(null);
    await expect(sync.rollbackCsDevice(DEV_EUI, "DB gagal")).resolves.toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("DB gagal"));
  });

  test("[negative] rollback gagal -> false & log minta hapus manual (tidak melempar)", async () => {
    cs.deleteCsDevice.mockRejectedValue(new Error("timeout"));
    await expect(sync.rollbackCsDevice(DEV_EUI)).resolves.toBe(false);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining("hapus manual"));
  });
});

describe("pushReportInterval", () => {
  test("[positive] menit dikonversi ke detik", async () => {
    cs.setReportInterval.mockResolvedValue({});
    await expect(sync.pushReportInterval(DEV_EUI, "30")).resolves.toEqual({ delivered: true, notes: null });
    expect(cs.setReportInterval).toHaveBeenCalledWith(DEV_EUI, 1800);
  });

  test("[negative] gagal kirim -> delivered:false dengan alasan, tidak melempar", async () => {
    cs.setReportInterval.mockRejectedValue(new Error("Meter tidak merespons"));
    await expect(sync.pushReportInterval(DEV_EUI, 15)).resolves.toEqual({
      delivered: false,
      notes: "Meter tidak merespons",
    });
  });
});
