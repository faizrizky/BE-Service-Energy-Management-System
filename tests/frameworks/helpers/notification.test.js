jest.mock("../../../src/application/use_cases/notification/create.usecase", () => ({
  createNotification: jest.fn(),
}));

const usecase = require("../../../src/application/use_cases/notification/create.usecase");
const logger = require("../../../src/frameworks/helpers/logger");
const { createNotification } = require("../../../src/frameworks/helpers/notification");

beforeEach(() => jest.clearAllMocks());

describe("helpers/notification.createNotification", () => {
  test("[positive] langsung lewat use case (bukan HTTP ke API sendiri), selalu belum dibaca", async () => {
    usecase.createNotification.mockResolvedValue({ id: "n1" });

    await expect(
      createNotification({ data: { id: "d1" }, eventType: "success", message: "Device diupdate", readAt: "true" }),
    ).resolves.toEqual({ id: "n1" });

    expect(usecase.createNotification).toHaveBeenCalledWith({
      data: { id: "d1" },
      eventType: "success",
      message: "Device diupdate",
      readAt: false,
    });
  });

  test("[negative] gagal simpan -> null & dicatat, aksi utama nggak ikut gagal", async () => {
    usecase.createNotification.mockRejectedValue(new Error("db down"));
    await expect(createNotification({ eventType: "success", message: "x" })).resolves.toBeNull();
    expect(logger.error).toHaveBeenCalledWith("[Notification] Gagal bikin notifikasi:", "db down");
  });
});
